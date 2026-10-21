const defaults = require( '@wordpress/scripts/config/jest-unit.config' );

module.exports = {
	...defaults,
	testMatch: [ '<rootDir>/tests/js/**/*.test.js' ],
};
