import {
	applyMapping,
	autoMap,
	normaliseHeader,
	toCsv,
} from '../../src/shared/csv';

const fields = [
	{ key: 'first_name', label: 'First name', crm: { attribute: 'firstname' } },
	{ key: 'email', label: 'Email', crm: { attribute: 'emailaddress1' } },
	{ key: 'company', label: 'Company' },
];

describe( 'csv helpers', () => {
	test( 'normaliseHeader strips BOM, case and punctuation', () => {
		expect( normaliseHeader( '﻿First Name' ) ).toBe( 'firstname' );
		expect( normaliseHeader( 'e-mail' ) ).toBe( 'email' );
	} );

	test( 'autoMap matches by key, label or CRM attribute', () => {
		const mapping = autoMap( [ 'Company', 'firstname', 'E-mail' ], fields );
		expect( mapping ).toEqual( { first_name: 1, email: 2, company: 0 } );
	} );

	test( 'autoMap never assigns one column twice', () => {
		const mapping = autoMap(
			[ 'email' ],
			[
				{ key: 'email', label: 'Email' },
				{ key: 'email2', label: 'Email' },
			]
		);
		expect( mapping ).toEqual( { email: 0, email2: -1 } );
	} );

	test( 'applyMapping builds trimmed rows', () => {
		expect(
			applyMapping( [ [ ' Ann ', 'a@x.com', '' ] ], {
				first_name: 0,
				email: 1,
				company: -1,
			} )
		).toEqual( [ { first_name: 'Ann', email: 'a@x.com' } ] );
	} );

	test( 'toCsv quotes and neutralises formulas', () => {
		const csv = toCsv( [ 'a', 'b' ], [ [ '=SUM(1)', 'x, "y"' ] ] );
		expect( csv ).toBe( '﻿a,b\r\n\'=SUM(1),"x, ""y"""' );
	} );
} );
