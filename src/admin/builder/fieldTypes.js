import { __ } from '@wordpress/i18n';

const options = () => [
	{ label: __( 'Option 1', 'contact-sync' ), value: 'option_1' },
	{ label: __( 'Option 2', 'contact-sync' ), value: 'option_2' },
	{ label: __( 'Option 3', 'contact-sync' ), value: 'option_3' },
];

export const FIELD_TYPES = {
	text: {
		label: __( 'Short text', 'contact-sync' ),
		icon: 'text',
		group: 'basic',
		defaults: { label: __( 'Text', 'contact-sync' ) },
	},
	email: {
		label: __( 'Email', 'contact-sync' ),
		icon: 'at',
		group: 'basic',
		defaults: { label: __( 'Email', 'contact-sync' ) },
		crm: 'emailaddress1',
	},
	phone: {
		label: __( 'Phone', 'contact-sync' ),
		icon: 'phone',
		group: 'basic',
		defaults: { label: __( 'Phone', 'contact-sync' ) },
		crm: 'telephone1',
	},
	number: {
		label: __( 'Number', 'contact-sync' ),
		icon: 'hash',
		group: 'basic',
		defaults: { label: __( 'Number', 'contact-sync' ) },
	},
	textarea: {
		label: __( 'Long text', 'contact-sync' ),
		icon: 'textarea',
		group: 'basic',
		defaults: { label: __( 'Notes', 'contact-sync' ) },
	},
	url: {
		label: __( 'Website', 'contact-sync' ),
		icon: 'link',
		group: 'basic',
		defaults: { label: __( 'Website', 'contact-sync' ) },
		crm: 'websiteurl',
	},
	date: {
		label: __( 'Date', 'contact-sync' ),
		icon: 'calendar',
		group: 'basic',
		defaults: { label: __( 'Date', 'contact-sync' ) },
	},
	select: {
		label: __( 'Dropdown', 'contact-sync' ),
		icon: 'select',
		group: 'choice',
		defaults: { label: __( 'Dropdown', 'contact-sync' ), options },
	},
	radio: {
		label: __( 'Single choice', 'contact-sync' ),
		icon: 'radio',
		group: 'choice',
		defaults: { label: __( 'Choose one', 'contact-sync' ), options },
	},
	checkboxes: {
		label: __( 'Multiple choice', 'contact-sync' ),
		icon: 'checks',
		group: 'choice',
		defaults: { label: __( 'Choose any', 'contact-sync' ), options },
	},
	checkbox: {
		label: __( 'Yes / No checkbox', 'contact-sync' ),
		icon: 'checkSquare',
		group: 'choice',
		defaults: {
			label: __( 'Consent', 'contact-sync' ),
			placeholder: __(
				'The contact agreed to be contacted',
				'contact-sync'
			),
		},
	},
	section: {
		label: __( 'Section heading', 'contact-sync' ),
		icon: 'heading',
		group: 'layout',
		defaults: {
			label: __( 'Section title', 'contact-sync' ),
			description: '',
		},
	},
	divider: {
		label: __( 'Divider', 'contact-sync' ),
		icon: 'divider',
		group: 'layout',
		defaults: { label: '' },
	},
	hidden: {
		label: __( 'Hidden value', 'contact-sync' ),
		icon: 'eyeOff',
		group: 'advanced',
		defaults: { label: __( 'Hidden value', 'contact-sync' ), default: '' },
	},
};

export const GROUPS = [
	{ id: 'basic', label: __( 'Basic', 'contact-sync' ) },
	{ id: 'choice', label: __( 'Choices', 'contact-sync' ) },
	{ id: 'layout', label: __( 'Layout', 'contact-sync' ) },
	{ id: 'advanced', label: __( 'Advanced', 'contact-sync' ) },
];

export const CHOICE_TYPES = [ 'select', 'radio', 'checkboxes' ];
export const LAYOUT_TYPES = [ 'section', 'divider' ];
export const isLayout = ( field ) => LAYOUT_TYPES.includes( field.type );

export const slugify = ( text ) =>
	String( text || '' )
		.toLowerCase()
		.normalize( 'NFKD' )
		.replace( /[̀-ͯ]/g, '' )
		.replace( /[^a-z0-9]+/g, '_' )
		.replace( /^_+|_+$/g, '' )
		.slice( 0, 40 );

export function uniqueKey( base, fields, ignoreId ) {
	const taken = new Set(
		fields.filter( ( f ) => f.id !== ignoreId ).map( ( f ) => f.key )
	);
	const root = base || 'field';
	let key = root;
	let n = 2;
	while ( taken.has( key ) ) {
		key = `${ root }_${ n++ }`;
	}
	return key;
}

/**
 * Create a new field of a type with sensible defaults.
 *
 * @param {string} type   Field type.
 * @param {Array}  fields Existing fields (for unique keys and CRM suggestions).
 * @return {Object} Field.
 */
export function createField( type, fields ) {
	const def = FIELD_TYPES[ type ];
	const defaults = { ...def.defaults };
	if ( typeof defaults.options === 'function' ) {
		defaults.options = defaults.options();
	}
	const id = `f_${ Math.random().toString( 36 ).slice( 2, 10 ) }`;
	const key = uniqueKey( slugify( defaults.label ) || type, fields );
	const mapped = new Set(
		fields.map( ( f ) => f.crm?.attribute ).filter( Boolean )
	);

	return {
		id,
		type,
		key,
		label: '',
		placeholder: '',
		help: '',
		default: '',
		required: false,
		width: 'full',
		validation: {},
		crm: {
			attribute: def.crm && ! mapped.has( def.crm ) ? def.crm : '',
			type: 'string',
		},
		conditions: { enabled: false, action: 'show', match: 'all', rules: [] },
		...defaults,
	};
}
