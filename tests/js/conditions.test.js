/**
 * The same fixture is used by tests/php/ConditionEvaluatorTest.php so both
 * evaluators are guaranteed to agree.
 */
import fixture from '../fixtures/conditions.json';
import { evaluateRule, visibility } from '../../src/shared/conditions';

describe( 'evaluateRule', () => {
	test.each( fixture.rules )(
		'$operator $actual vs $expected → $result',
		( { operator, actual, expected, result } ) => {
			expect( evaluateRule( operator, actual, expected ) ).toBe( result );
		}
	);
} );

describe( 'visibility', () => {
	fixture.forms.forEach( ( form ) => {
		form.cases.forEach( ( c, i ) => {
			test( `${ form.name } #${ i + 1 }`, () => {
				expect( visibility( form.fields, c.values ) ).toEqual(
					c.visible
				);
			} );
		} );
	} );
} );
