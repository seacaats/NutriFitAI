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
const { moderateImage, throwIfRejected } = require('../../services/moderation/imageModeration');
const { logModeration } = require('../../services/moderation/moderationLog');

// ===========================================================================
// CATALOG
// ===========================================================================

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 60;

const LIST_PROJECTION = 'name description category muscles equipment images hasRealImage source imageKey';

function parseLimit(raw) {
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT;
  return Math.min(n, MAX_LIMIT);
}

// GET /api/workouts
const listWorkouts = asyncHandler(async (req, res) => {
  const { category, search, hasImage, equipment, muscles, musclesSecondary, source, ids, shuffle } = req.query;
  const limit = parseLimit(req.query.limit);
  const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);

  const filter = { $and: [Workout.visibleTo(req.userId)] };

  if (category) {
    const categoryId = parseInt(category, 10);
    if (!Number.isFinite(categoryId)) {
      throw ApiError.badRequest('category must be a numeric id');
    }
    filter['category.id'] = categoryId;
  }

  // Default to exercises with images (user workouts are always included via fallback icon)
  if (hasImage !== 'false') {
    filter.$and.push({ $or: [{ hasRealImage: true }, { source: 'user' }] });
  }

  if (ids) filter._id = { $in: ids.split(',').map(Number) };
  if (source) filter.$and.push({ source });

  // Equipment filter: "none" (bodyweight), "any" (requires equipment), or specific numeric ID
  if (equipment === 'none') {
    filter.$or = [{ equipment: { $size: 0 } }, { 'equipment.name': NO_EQUIPMENT }];
  } else if (equipment === 'any') {
    filter.equipment = { $elemMatch: { name: { $not: NO_EQUIPMENT } } };
  } else if (equipment) {
    filter['equipment.id'] = Number(equipment);
  }

  if (muscles) filter['muscles.id'] = { $in: muscles.split(',').map(Number) };
  if (musclesSecondary) filter['musclesSecondary.id'] = { $in: musclesSecondary.split(',').map(Number) };

  // Shuffled browse mode (prioritizes user workout preferences when unfiltered)
  if (shuffle && !(search && search.trim()) && !ids && source !== 'user') {
    const data = await listShuffled(req.userId, Number(shuffle), filter, !category && !equipment && !muscles && !musclesSecondary && !source, limit, offset);
    return sendSuccess(res, { data });
  }

  // Case-insensitive substring search across name, muscles, and category
  const term = typeof search === 'string' ? search.trim().slice(0, 100) : '';
  if (term) {
    const rx = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$and.push({ $or: [{ name: rx }, { 'muscles.name': rx }, { 'category.name': rx }] });
  }

  const query = Workout.find(filter, LIST_PROJECTION).collation({ locale: 'en', strength: 1 }).sort({ name: 1 });
  let total;

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
      hasMore: offset + items.length < total,
    },
  });
});

function projectionObject() {
  return LIST_PROJECTION.split(' ').reduce((acc, field) => ({ ...acc, [field]: 1 }), {});
}

// Map _id to id and resolve user-uploaded imageKey to a signed URL
async function shapeWorkout(doc) {
  if (!doc) return null;
  const { _id, score, createdBy, imageKey, ...rest } = doc;
  return { id: _id, ...rest, ...(imageKey && { images: [await storage.urlFor(imageKey)] }) };
}

const SHUFFLE_VARIANTS = 8;
// Prime modulus for deterministic per-variant shuffle ordering across pages
const SHUFFLE_MODULUS = 1000003;

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

function shuffledPage(filter, multiplier, skip, limit) {
  if (limit <= 0) return [];
  return Workout.aggregate([
    { $match: filter },
    { $project: projectionObject() },
    { $addFields: { shuffleKey: { $mod: [{ $multiply: ['$_id', multiplier] }, SHUFFLE_MODULUS] } } },
    { $sort: { shuffleKey: 1, _id: 1 } },
    { $skip: skip },
    { $limit: limit },
    { $project: { shuffleKey: 0 } },
  ]);
}

// Paginate deterministically shuffled exercises, placing preference matches first when unfiltered
async function listShuffled(userId, shuffle, base, usePrefs, limit, offset) {
  const profile = usePrefs ? await User.getProfile(userId) : null;
  const preferred = preferenceFilter(profile?.workoutPrefs);
  const matching = preferred ? { ...base, ...preferred } : null;
  const rest = preferred ? { ...base, $nor: [preferred] } : base;

  const [matchCount, restCount] = await Promise.all([
    matching ? Workout.countDocuments(matching) : 0,
    Workout.countDocuments(rest),
  ]);

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

// GET /api/workouts/:id
const getWorkout = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) {
    throw ApiError.badRequest("We couldn't find that exercise.");
  }

  const doc = await Workout.findOne({ _id: id, ...Workout.visibleTo(req.userId) }).lean();
  if (!doc) {
    throw ApiError.notFound('Exercise not found');
  }

  return sendSuccess(res, { data: await shapeWorkout(doc) });
});

// Find visible workout by name ignoring case and punctuation; user-owned matches take precedence
async function findByName(name, userId, excludeId = null) {
  const filter = { name, ...Workout.visibleTo(userId) };
  if (excludeId != null) filter._id = { $ne: excludeId };
  const rows = await Workout.find(filter, 'name source')
    .collation({ locale: 'en', strength: 1, alternate: 'shifted' })
    .limit(5)
    .lean();
  return rows.find((r) => r.source === 'user') || rows[0] || null;
}

// GET /api/workouts/match?name=&excludeId=
const matchWorkout = asyncHandler(async (req, res) => {
  const match = await findByName(req.query.name, req.userId, req.query.excludeId ? Number(req.query.excludeId) : null);
  return sendSuccess(res, {
    data: { match: match ? { id: match._id, name: match.name, source: match.source } : null },
  });
});

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

// Resolve category, equipment, and muscle IDs against catalog documents
async function resolveCatalogFields({ categoryId, equipmentIds, muscleIds = [], secondaryMuscleIds = [] }) {
  const category = categoryId ? await WorkoutCategory.findById(categoryId, 'name').lean() : null;
  if (categoryId && !category) throw ApiError.badRequest('Unknown category');
  const equipment = equipmentIds?.length
    ? await Workout.aggregate([
      { $unwind: '$equipment' },
      { $match: { 'equipment.id': { $in: equipmentIds } } },
      { $group: { _id: '$equipment.id', name: { $first: '$equipment.name' } } },
    ])
    : [];

  const found = await lookupMuscles([...new Set([...muscleIds, ...secondaryMuscleIds])]);
  const pick = (ids) => ids.map((id) => found.get(id)).filter(Boolean);

  return {
    category: category ? { id: category._id, name: category.name } : null,
    muscles: pick(muscleIds),
    musclesSecondary: pick(secondaryMuscleIds.filter((id) => !muscleIds.includes(id))),
    equipment: equipment.map((e) => ({ id: e._id, name: e.name })),
  };
}

// POST /api/workouts
const createWorkout = asyncHandler(async (req, res) => {
  const { name, description, categoryId, equipmentIds, muscleIds = [], secondaryMuscleIds = [], confirmDuplicate } = req.body;

  const match = await findByName(name, req.userId);
  if (match?.source === 'user') {
    throw ApiError.conflict('You already have a workout with that name.', { code: 'DUPLICATE_OWN' });
  }
  if (match && !confirmDuplicate) {
    throw ApiError.conflict('A workout with that name is already in the catalog.', { code: 'DUPLICATE_WGER' });
  }

  const resolved = await resolveCatalogFields({ categoryId, equipmentIds, muscleIds, secondaryMuscleIds });

  const created = await Workout.createForUser(req.userId, {
    name,
    description: description || null,
    ...resolved,
  });

  return sendSuccess(res, { statusCode: 201, message: 'Workout added', data: await shapeWorkout(created) });
});

// PATCH /api/workouts/:id
const updateWorkout = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw ApiError.notFound('Workout not found');

  const existing = await Workout.findOne({ _id: id, source: 'user', createdBy: req.userId }).lean();
  if (!existing) throw ApiError.notFound('Workout not found');

  const { name, description, categoryId, equipmentIds, muscleIds, secondaryMuscleIds, removePhoto, confirmDuplicate } = req.body;

  if (name !== undefined) {
    const match = await findByName(name, req.userId, id);
    if (match?.source === 'user') {
      throw ApiError.conflict('You already have a workout with that name.', { code: 'DUPLICATE_OWN' });
    }
    const sameAsBefore = existing.name.trim().toLowerCase() === name.trim().toLowerCase();
    if (match && !confirmDuplicate && !sameAsBefore) {
      throw ApiError.conflict('A workout with that name is already in the catalog.', { code: 'DUPLICATE_WGER' });
    }
  }

  const resolved = await resolveCatalogFields({
    categoryId: categoryId !== undefined ? categoryId : existing.category?.id,
    equipmentIds: equipmentIds !== undefined ? equipmentIds : (existing.equipment || []).map((e) => e.id),
    muscleIds: muscleIds !== undefined ? muscleIds : (existing.muscles || []).map((m) => m.id),
    secondaryMuscleIds: secondaryMuscleIds !== undefined ? secondaryMuscleIds : (existing.musclesSecondary || []).map((m) => m.id),
  });

  const $set = {
    ...(name !== undefined ? { name } : {}),
    ...(description !== undefined ? { description: description || null } : {}),
    ...resolved,
    ...(removePhoto ? { imageKey: null, hasRealImage: false } : {}),
  };

  const renamed = name !== undefined && name !== existing.name;
  const updated = await withTransaction(async (client) => {
    const doc = await Workout.updateOwned(id, req.userId, $set, client);
    if (!doc) return null;
    if (renamed) {
      await FavoriteWorkout.rename('exercise', String(id), doc.name, client);
      await WorkoutRoutine.renameExercise(req.userId, id, doc.name, client);
      await WorkoutSession.renameExercise(req.userId, id, doc.name, client);
    }
    return doc;
  });
  if (!updated) throw ApiError.notFound('Workout not found');

  if (removePhoto && existing.imageKey) await storage.remove(existing.imageKey);

  return sendSuccess(res, { message: 'Workout updated', data: await shapeWorkout(updated) });
});

// POST /api/workouts/:id/photo
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
      'Unsupported file format. Please upload a JPEG, PNG, or WebP image under 2 MB.',
      { code: 'INVALID_IMAGE' },
    );
  }

  const checked = await moderateImage(req.file.buffer, contentType);
  if (checked.verdict === 'block') {
    await logModeration({ userId: req.userId, kind: 'workout', refId: id }, checked);
    throwIfRejected(checked);
  }

  const { key } = await storage.save(req.file.buffer, { key: storage.keys.workoutImageKey(req.userId, contentType), contentType });
  const updated = await Workout.findOneAndUpdate(
    { _id: id, createdBy: req.userId },
    { $set: { imageKey: key, hasRealImage: true } },
    { new: true },
  ).lean();
  if (workout.imageKey) await storage.remove(workout.imageKey);
  await logModeration({ userId: req.userId, kind: 'workout', storageKey: key, refId: id }, checked);

  return sendSuccess(res, { message: 'Photo added', data: await shapeWorkout(updated) });
});

// DELETE /api/workouts/:id -- delete user workout, cascade across favorites/routines/sessions, and remove photo
const deleteWorkout = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw ApiError.notFound('Workout not found');

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

  if (removed.imageKey) await storage.remove(removed.imageKey);

  return sendSuccess(res, { message: 'Workout deleted' });
});

const NO_EQUIPMENT = /^none/i;

// GET /api/workouts/equipment
const listEquipment = asyncHandler(async (req, res) => {
  const rows = await Workout.aggregate([
    { $unwind: '$equipment' },
    { $match: { 'equipment.name': { $not: NO_EQUIPMENT } } },
    { $group: { _id: '$equipment.id', name: { $first: '$equipment.name' } } },
    { $sort: { name: 1 } },
  ]);
  return sendSuccess(res, { data: rows.map((r) => ({ id: r._id, name: r.name })) });
});

// GET /api/workouts/muscles
const listMuscles = asyncHandler(async (req, res) => {
  const rows = await Workout.aggregate([
    { $project: { m: { $concatArrays: ['$muscles', '$musclesSecondary'] } } },
    { $unwind: '$m' },
    { $group: { _id: '$m.id', name: { $first: { $ifNull: ['$m.nameEn', '$m.name'] } } } },
    { $sort: { name: 1 } },
  ]);
  return sendSuccess(res, { data: rows.map((r) => ({ id: r._id, name: r.name })) });
});

// GET /api/workouts/categories
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
  updateWorkout,
  uploadWorkoutPhoto,
  deleteWorkout,
};
