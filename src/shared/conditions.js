/**
 * Conditional logic evaluation.
 *
 * Mirrors includes/Forms/ConditionEvaluator.php; both are tested against
 * tests/fixtures/conditions.json so the browser and server always agree.
 */

const norm = ( value ) =>
	String( value ?? '' )
		.trim()
		.toLowerCase();

const split = ( value ) =>
	value
		.split( ',' )
		.map( ( item ) => item.trim() )
		.filter( Boolean );

const isNumeric = ( value ) =>
	value !== '' &&
	! Number.isNaN( Number( value ) ) &&
	Number.isFinite( Number( value ) );

/**
 * Evaluate a single rule.
 *
 * @param {string}          operator Operator.
 * @param {string|string[]} actual   Field value.
 * @param {string}          expected Rule value.
 * @return {boolean} Whether the rule matches.
 */
export function evaluateRule( operator, actual, expected ) {
	const want = norm( expected );

	if ( Array.isArray( actual ) ) {
		const list = actual.map( norm ).filter( ( item ) => item !== '' );
		switch ( operator ) {
			case 'equals':
			case 'contains':
				return list.includes( want );
			case 'not_equals':
			case 'not_contains':
				return ! list.includes( want );
			case 'empty':
				return list.length === 0;
			case 'not_empty':
				return list.length > 0;
			case 'in': {
				const options = split( want );
				return list.some( ( item ) => options.includes( item ) );
			}
			default:
				return false;
		}
	}

	const value = norm( actual );
	switch ( operator ) {
		case 'equals':
			return value === want;
		case 'not_equals':
			return value !== want;
		case 'contains':
			return want !== '' && value.includes( want );
		case 'not_contains':
			return want === '' || ! value.includes( want );
		case 'empty':
			return value === '';
		case 'not_empty':
			return value !== '';
		case 'gt':
			return (
				isNumeric( value ) &&
				isNumeric( want ) &&
				Number( value ) > Number( want )
			);
		case 'lt':
			return (
				isNumeric( value ) &&
				isNumeric( want ) &&
				Number( value ) < Number( want )
			);
		case 'in':
			return split( want ).includes( value );
		default:
			return false;
	}
}

function passes( conditions, values, visible ) {
	if ( ! conditions?.enabled || ! conditions.rules?.length ) {
		return true;
	}
	const results = conditions.rules.map( ( rule ) => {
		const value =
			visible[ rule.field ] === false ? '' : values[ rule.field ] ?? '';
		return evaluateRule( rule.operator, value, rule.value ?? '' );
	} );
	const matched =
		conditions.match === 'any'
			? results.includes( true )
			: ! results.includes( false );
	return conditions.action === 'hide' ? ! matched : matched;
}

/**
 * Visibility map for every field, evaluated in order.
 *
 * A field inside a hidden section is hidden; a rule that points at a hidden field
 * sees an empty value.
 *
 * @param {Array}  fields Schema fields.
 * @param {Object} values Values keyed by field key.
 * @return {Object} Field key => visible.
 */
export function visibility( fields, values ) {
	const visible = {};
	let sectionVisible = true;

	for ( const field of fields ) {
		const own = passes( field.conditions, values, visible );
		if ( field.type === 'section' ) {
			sectionVisible = own;
			visible[ field.key ] = own;
			continue;
		}
		visible[ field.key ] = sectionVisible && own;
	}
	return visible;
}

export const OPERATORS = {
	equals: 'is',
	not_equals: 'is not',
	contains: 'contains',
	not_contains: 'does not contain',
	empty: 'is empty',
	not_empty: 'is not empty',
	gt: 'is greater than',
	lt: 'is less than',
	in: 'is one of',
};

export const VALUELESS_OPERATORS = [ 'empty', 'not_empty' ];
