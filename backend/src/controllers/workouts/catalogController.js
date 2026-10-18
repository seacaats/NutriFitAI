const { withTransaction } = require('../../../config/mongo');
const Workout = require('../../models/workouts/Workout');
const WorkoutCategory = require('../../models/workouts/WorkoutCategory');
const WorkoutSession = require('../../models/workouts/WorkoutSession');
const WorkoutRoutine = require('../../models/workouts/WorkoutRoutine');
const FavoriteWorkout = require('../../models/workouts/FavoriteWorkout');
const User = require('../../models/user/User');
const { asyncHandler, sendSuccess, ApiError } = require('../../utils/httpResponse');
const storage = require('../../utils/storage');
const { looksLikeImage, EXT_BY_TYPE } = require('../../utils/storage/keys');

// ===========================================================================
// CATALOG -- the locally synced wger data, plus each user's own workouts
// ===========================================================================

/**
 * Serves the locally synced wger catalog.
 *
 * Read-only apart from createWorkout: wger's side is written by
 * scripts/sync-workouts.js alone, and a user only ever adds their own workout
 * (source 'user'), and deletes them again. The endpoints sit behind requireAuth,
 * because an open, unauthenticated list endpoint is free bandwidth for anyone
 * who finds it.
 */

/** 60 is generous for a grid; the cap stops a client asking for the lot. */
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 60;

/** Fields the client actually renders. Excludes syncedAt and secondary muscles. */
const LIST_PROJECTION = 'name description category muscles equipment images hasRealImage source imageKey';

function parseLimit(raw) {
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT;
  return Math.min(n, MAX_LIMIT);
}

/**
 * GET /api/workouts
 *
 * Query: category, search, hasImage, equipment, muscles, musclesSecondary, ids, limit, offset, shuffle
 */
const listWorkouts = asyncHandler(async (req, res) => {
  const { category, search, hasImage, equipment, muscles, musclesSecondary, source, ids, shuffle } = req.query;
  const limit = parseLimit(req.query.limit);
  const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);

  // $and, so it can't clash with the $or of the equipment filter
  const filter = { $and: [Workout.visibleTo(req.userId)] };

  if (category) {
    const categoryId = parseInt(category, 10);
    if (!Number.isFinite(categoryId)) {
      throw ApiError.badRequest('category must be a numeric id');
    }
    filter['category.id'] = categoryId;
  }

  /**
   * Defaults to true, which is what the UI has always actually wanted.
   *
   * The screen used to page through wger over the network until it had
   * collected enough exercises with pictures. That loop existed because the
   * upstream API could not answer this question; the synced `hasRealImage`
   * flag can, from an index. Pass hasImage=false to include the rest.
   */
  if (hasImage !== 'false') {
    // User workouts have no photo of their own, the client shows a fallback
    filter.$and.push({ $or: [{ hasRealImage: true }, { source: 'user' }] });
  }

  if (ids) filter._id = { $in: ids.split(',').map(Number) };

  // wger's or the user's own. Their own are still only ever theirs: the
  // visibility clause above is in the same $and
  if (source) filter.$and.push({ source });

  // "none" = bodyweight: no equipment listed, or wger's own "none" entry.
  // "any" = needs something. A number = that piece of equipment
  if (equipment === 'none') {
    filter.$or = [{ equipment: { $size: 0 } }, { 'equipment.name': NO_EQUIPMENT }];
  } else if (equipment === 'any') {
    filter.equipment = { $elemMatch: { name: { $not: NO_EQUIPMENT } } };
  } else if (equipment) {
    filter['equipment.id'] = Number(equipment);
  }

  // Muscles: a workout working any of the chosen ones, as main or as secondary
  if (muscles) filter['muscles.id'] = { $in: muscles.split(',').map(Number) };
  if (musclesSecondary) filter['musclesSecondary.id'] = { $in: musclesSecondary.split(',').map(Number) };

  // Browse: shuffled, within any category or equipment filter. Unfiltered, the
  // user's preferred exercises come first. A search or an id list keeps its own
  // order, and so do the user's own workouts (alphabetical, a short list)
  if (shuffle && !search && !ids && source !== 'user') {
    const data = await listShuffled(req.userId, Number(shuffle), filter, !category && !equipment && !muscles && !musclesSecondary && !source, limit, offset);
    return sendSuccess(res, { data });
  }

  let query;
  let total;

  if (search && search.trim()) {
    /**
     * Text search over name, muscle names and category, weighted toward the
     * name (see the index definition in models/health/Workout.js).
     *
     * Ordered by relevance rather than by name: a query for "bench" should put
     * "Bench Press" above "Incline Dumbbell Bench Fly".
     *
     * NOTE ON THE SORT: the free tier caps in-memory sorts at 32 MB and ignores
     * allowDiskUse, so an uncovered sort FAILS rather than running slowly. A
     * textScore sort is computed during the text-index scan and is safe at this
     * collection size, but if a category filter is ever combined with a large
     * result set and this starts erroring, narrow the match before sorting
     * rather than adding indexes that cost storage.
     */
    filter.$text = { $search: search.trim() };

    query = Workout.find(filter, { score: { $meta: 'textScore' }, ...projectionObject() })
      .sort({ score: { $meta: 'textScore' } });
  } else {
    // Stable alphabetical order. Without an explicit sort the driver returns
    // natural order, which shifts as documents are updated — so page 2 could
    // repeat an item from page 1 after a sync.
    query = Workout.find(filter, LIST_PROJECTION).collation({ locale: 'en', strength: 1 }).sort({ name: 1 });
  }

  const [items, count] = await Promise.all([
    query.skip(offset).limit(limit).lean(),
    Workout.countDocuments(filter),
  ]);
  total = count;

  return sendSuccess(res, {
    data: {
      items: await Promise.all(items.map(shapeWorkout)),
      total,
      limit,
      offset,
      // Mirrors what the client used to get from wger's own pagination, so the
      // infinite-scroll logic in the screens does not have to change shape.
      hasMore: offset + items.length < total,
    },
  });
});

/** Projection as an object, for the branch that also projects textScore. */
function projectionObject() {
  return LIST_PROJECTION.split(' ').reduce((acc, field) => ({ ...acc, [field]: 1 }), {});
}

/**
 * The client treats `id` as canonical everywhere; _id here is wger's numeric id
 * rather than an ObjectId, so this is a rename, not a conversion.
 */
// A user's own photo becomes a signed link here, wger's images are links already
async function shapeWorkout(doc) {
  if (!doc) return null;
  const { _id, score, createdBy, imageKey, ...rest } = doc;
  return { id: _id, ...rest, ...(imageKey && { images: [await storage.urlFor(imageKey)] }) };
}

// Shuffled orders the client picks from at random. Few on purpose: each one
// is its own URL in the phone's offline cache
const SHUFFLE_VARIANTS = 8;
// A prime above any wger id. (id * multiplier) mod it is a different
// scramble per multiplier, and the same one every time, so paging is stable
const SHUFFLE_MODULUS = 1000003;

// The user's workoutPrefs as a catalog filter, or null when they have none
function preferenceFilter(prefs) {
  const filter = {};
  if (prefs?.categoryIds?.length) filter['category.id'] = { $in: prefs.categoryIds };
  if (prefs?.equipment === 'none') {
    filter.$or = [{ equipment: { $size: 0 } }, { 'equipment.name': NO_EQUIPMENT }];
  } else if (prefs?.equipment === 'any') {
    filter.equipment = prefs.equipmentIds?.length
      ? { $elemMatch: { id: { $in: prefs.equipmentIds } } }
      : { $elemMatch: { name: { $not: NO_EQUIPMENT } } };
  }
  if (prefs?.muscleIds?.length) filter['muscles.id'] = { $in: prefs.muscleIds };
  if (prefs?.secondaryMuscleIds?.length) filter['musclesSecondary.id'] = { $in: prefs.secondaryMuscleIds };
  return Object.keys(filter).length ? filter : null;
}

// One shuffled page of `filter`: the same order every time for a given
// multiplier, so paging never repeats or skips an exercise
function shuffledPage(filter, multiplier, skip, limit) {
  if (limit <= 0) return [];
  return Workout.aggregate([
    { $match: filter },
    { $project: projectionObject() },
    { $addFields: { shuffleKey: { $mod: [{ $multiply: ['$_id', multiplier] }, SHUFFLE_MODULUS] } } },
    // $sort + $skip + $limit run as one top-k sort, well under the 32 MB cap
    { $sort: { shuffleKey: 1, _id: 1 } },
    { $skip: skip },
    { $limit: limit },
    { $project: { shuffleKey: 0 } },
  ]);
}

/**
 * One page of the Browse list: `base` (the catalog, or a category/equipment
 * filter of it), shuffled. Unfiltered with workout preferences, matching
 * exercises come first and everything else after; preferences order the
 * list, they never hide anything. `suggested` is true only then, for the
 * "Picked for you" title
 */
async function listShuffled(userId, shuffle, base, usePrefs, limit, offset) {
  const profile = usePrefs ? await User.getProfile(userId) : null;
  const preferred = preferenceFilter(profile?.workoutPrefs);
  const matching = preferred ? { ...base, ...preferred } : null;
  const rest = preferred ? { ...base, $nor: [preferred] } : base;

  const [matchCount, restCount] = await Promise.all([
    matching ? Workout.countDocuments(matching) : 0,
    Workout.countDocuments(rest),
  ]);

  // Preferred exercises fill the first pages; a page that runs past them
  // continues straight into the rest
  const multiplier = 7919 * Math.min(Math.max(shuffle, 1), SHUFFLE_VARIANTS) + 104729;
  const fromMatching = matching
    ? await shuffledPage(matching, multiplier, offset, Math.min(limit, matchCount - offset))
    : [];
  const fromRest = await shuffledPage(rest, multiplier, Math.max(0, offset - matchCount), limit - fromMatching.length);
  const items = [...fromMatching, ...fromRest];
  const total = matchCount + restCount;

  return {
    items: await Promise.all(items.map(shapeWorkout)),
    total,
    limit,
    offset,
    hasMore: offset + items.length < total,
    suggested: matchCount > 0,
  };
}

/** GET /api/workouts/:id */
const getWorkout = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) {
    throw ApiError.badRequest('Invalid exercise id');
  }

  const doc = await Workout.findOne({ _id: id, ...Workout.visibleTo(req.userId) }).lean();
  if (!doc) {
    throw ApiError.notFound('Exercise not found');
  }

  return sendSuccess(res, { data: await shapeWorkout(doc) });
});

// The workout this user can see under that name, ignoring case and punctuation
// such as "-" ("push-up" = "push up" = "pushup"). Their own
// wins over wger's, since a copy of their own is what blocks a second one
async function findByName(name, userId) {
  const rows = await Workout.find({ name, ...Workout.visibleTo(userId) }, 'name source')
    .collation({ locale: 'en', strength: 1, alternate: 'shifted' }) // shifted: skip punctuation/spaces
    .limit(5)
    .lean();
  return rows.find((r) => r.source === 'user') || rows[0] || null;
}

// GET /api/workouts/match?name= -- what the "Add workout" field checks while typing
const matchWorkout = asyncHandler(async (req, res) => {
  const match = await findByName(req.query.name, req.userId);
  return sendSuccess(res, {
    data: { match: match ? { id: match._id, name: match.name, source: match.source } : null },
  });
});

// The catalog's own muscle objects for these ids, in the shape workouts store
// them, so a user's workout matches a synced one
async function lookupMuscles(ids) {
  if (!ids.length) return new Map();
  const rows = await Workout.aggregate([
    { $project: { m: { $concatArrays: ['$muscles', '$musclesSecondary'] } } },
    { $unwind: '$m' },
    { $match: { 'm.id': { $in: ids } } },
    { $group: { _id: '$m.id', muscle: { $first: '$m' } } },
  ]);
  return new Map(rows.map((r) => [r._id, r.muscle]));
}

/**
 * POST /api/workouts -- adds a workout of the user's own, shaped like a synced
 * one. A name already in their own workouts is refused; one that matches
 * wger's needs confirmDuplicate, which the client sends after asking
 */
const createWorkout = asyncHandler(async (req, res) => {
  const { name, description, categoryId, equipmentIds, muscleIds = [], secondaryMuscleIds = [], confirmDuplicate } = req.body;

  const match = await findByName(name, req.userId);
  if (match?.source === 'user') {
    throw ApiError.conflict('You already have a workout with that name.', { code: 'DUPLICATE_OWN' });
  }
  if (match && !confirmDuplicate) {
    throw ApiError.conflict('A workout with that name is already in the catalog.', { code: 'DUPLICATE_WGER' });
  }

  // Names come from the catalog, not the client
  const category = categoryId ? await WorkoutCategory.findById(categoryId, 'name').lean() : null;
  if (categoryId && !category) throw ApiError.badRequest('Unknown category');
  const equipment = equipmentIds?.length
    ? await Workout.aggregate([
      { $unwind: '$equipment' },
      { $match: { 'equipment.id': { $in: equipmentIds } } },
      { $group: { _id: '$equipment.id', name: { $first: '$equipment.name' } } },
    ])
    : [];

  // A muscle chosen as main is not also secondary
  const found = await lookupMuscles([...new Set([...muscleIds, ...secondaryMuscleIds])]);
  const pick = (ids) => ids.map((id) => found.get(id)).filter(Boolean);

  const created = await Workout.createForUser(req.userId, {
    name,
    description: description || null,
    category: category ? { id: category._id, name: category.name } : null,
    muscles: pick(muscleIds),
    musclesSecondary: pick(secondaryMuscleIds.filter((id) => !muscleIds.includes(id))),
    equipment: equipment.map((e) => ({ id: e._id, name: e.name })),
  });

  return sendSuccess(res, { statusCode: 201, message: 'Workout added', data: await shapeWorkout(created) });
});

/**
 * POST /api/workouts/:id/photo   (multipart/form-data, field name: "photo")
 * A photo for one of the user's own workouts, stored like avatars and scans.
 * Replaces the one it had. wger's workouts can't be given one
 */
const uploadWorkoutPhoto = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw ApiError.notFound('Workout not found');
  const workout = await Workout.findOne({ _id: id, source: 'user', createdBy: req.userId }, 'imageKey').lean();
  if (!workout) throw ApiError.notFound('Workout not found');
  if (!req.file || !req.file.buffer) {
    throw ApiError.badRequest('No image was uploaded', { code: 'NO_FILE' });
  }

  const contentType = (req.file.mimetype || '').split(';')[0].trim().toLowerCase();
  if (!EXT_BY_TYPE[contentType] || !looksLikeImage(req.file.buffer, EXT_BY_TYPE[contentType])) {
    throw ApiError.badRequest(
      'That file could not be used. Upload a JPEG, PNG or WebP image under 2 MB.',
      { code: 'INVALID_IMAGE' },
    );
  }

  const { key } = await storage.save(req.file.buffer, { key: storage.keys.workoutImageKey(req.userId, contentType), contentType });
  const updated = await Workout.findOneAndUpdate(
    { _id: id, createdBy: req.userId },
    { $set: { imageKey: key, hasRealImage: true } },
    { new: true },
  ).lean();
  if (workout.imageKey) await storage.remove(workout.imageKey);

  return sendSuccess(res, { message: 'Photo added', data: await shapeWorkout(updated) });
});

/**
 * DELETE /api/workouts/:id -- one of the user's own workouts, and every trace
 * of it: favorite, routines (one left empty is deleted with its favorites and
 * plans), logged and planned sessions, and the photo. wger's can't be deleted
 */
const deleteWorkout = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw ApiError.notFound('Workout not found');

  // One transaction: it is gone everywhere or nowhere
  const removed = await withTransaction(async (client) => {
    const workout = await Workout.removeOwned(id, req.userId, client);
    if (!workout) return null;

    await FavoriteWorkout.drop(req.userId, 'exercise', String(id), client);
    const emptied = await WorkoutRoutine.removeExercise(req.userId, id, client);
    for (const routineId of emptied) {
      await FavoriteWorkout.removeAllFor('routine', routineId, client);
      await WorkoutSession.removePlannedForRoutine(routineId, req.userId, client);
    }
    await WorkoutSession.removeExercise(req.userId, id, client);
    return workout;
  });
  if (!removed) throw ApiError.notFound('Workout not found');

  // After the commit: a rolled-back delete must not have lost its photo
  if (removed.imageKey) await storage.remove(removed.imageKey);

  return sendSuccess(res, { message: 'Workout deleted' });
});

// wger lists bodyweight exercises under an equipment entry named "none (...)"
const NO_EQUIPMENT = /^none/i;

// GET /api/workouts/equipment -- every piece of equipment the catalog uses,
// for the filter. Bodyweight is its own option, so "none" is left out
const listEquipment = asyncHandler(async (req, res) => {
  const rows = await Workout.aggregate([
    { $unwind: '$equipment' },
    { $match: { 'equipment.name': { $not: NO_EQUIPMENT } } },
    { $group: { _id: '$equipment.id', name: { $first: '$equipment.name' } } },
    { $sort: { name: 1 } },
  ]);
  return sendSuccess(res, { data: rows.map((r) => ({ id: r._id, name: r.name })) });
});

// GET /api/workouts/muscles -- every muscle the catalog's workouts list, main
// or secondary, for the Add workout dialog
const listMuscles = asyncHandler(async (req, res) => {
  const rows = await Workout.aggregate([
    { $project: { m: { $concatArrays: ['$muscles', '$musclesSecondary'] } } },
    { $unwind: '$m' },
    { $group: { _id: '$m.id', name: { $first: { $ifNull: ['$m.nameEn', '$m.name'] } } } },
    { $sort: { name: 1 } },
  ]);
  return sendSuccess(res, { data: rows.map((r) => ({ id: r._id, name: r.name })) });
});

/** GET /api/workouts/categories */
const listCategories = asyncHandler(async (req, res) => {
  const categories = await WorkoutCategory.find({}, 'name').sort({ name: 1 }).lean();

  return sendSuccess(res, {
    data: categories.map((c) => ({ id: c._id, name: c.name })),
  });
});

module.exports = {
  listWorkouts,
  getWorkout,
  listCategories,
  listEquipment,
  listMuscles,
  matchWorkout,
  createWorkout,
  uploadWorkoutPhoto,
  deleteWorkout,
};