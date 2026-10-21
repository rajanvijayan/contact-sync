<?php
/**
 * Conditional logic tests (shared fixture with the JS evaluator).
 *
 * @package ContactSync
 */

use ContactSync\Forms\ConditionEvaluator;
use PHPUnit\Framework\TestCase;

class ConditionEvaluatorTest extends TestCase {

	private static function fixture() {
		return json_decode( file_get_contents( dirname( __DIR__ ) . '/fixtures/conditions.json' ), true );
	}

	public function rule_cases() {
		$cases = array();
		foreach ( self::fixture()['rules'] as $i => $case ) {
			$cases[ $i . ': ' . $case['operator'] ] = array( $case );
		}
		return $cases;
	}

	/**
	 * @dataProvider rule_cases
	 */
	public function test_rule( $case ) {
		$this->assertSame( $case['result'], ConditionEvaluator::rule( $case['operator'], $case['actual'], $case['expected'] ) );
	}

	public function form_cases() {
		$cases = array();
		foreach ( self::fixture()['forms'] as $form ) {
			foreach ( $form['cases'] as $i => $case ) {
				$cases[ $form['name'] . ' #' . ( $i + 1 ) ] = array( $form['fields'], $case['values'], $case['visible'] );
			}
		}
		return $cases;
	}

	/**
	 * @dataProvider form_cases
	 */
	public function test_visibility( $fields, $values, $expected ) {
		$this->assertSame( $expected, ConditionEvaluator::visibility( $fields, $values ) );
	}
}
