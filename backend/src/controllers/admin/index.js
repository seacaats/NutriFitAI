const users = require('./usersController');
const audit = require('./auditController');
const analytics = require('./analyticsController');
const imageReviews = require('./imageReviewsController');

module.exports = { ...users, ...audit, ...analytics, ...imageReviews };
