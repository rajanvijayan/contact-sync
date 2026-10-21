<?php
/**
 * Conditional logic evaluation.
 *
 * Mirrors src/shared/conditions.js; both are tested against tests/fixtures/conditions.json.
 *
 * @package ContactSync
 */

namespace ContactSync\Forms;

defined( 'ABSPATH' ) || exit;

/**
 * Works out which fields are visible for a given set of values.
 */
class ConditionEvaluator {

	/**
	 * Visibility map for every field.
	 *
	 * Fields are evaluated in order. A field inside a hidden section is hidden. A rule that
	 * points at a hidden field sees an empty value.
	 *
	 * @param array[] $fields Schema fields.
	 * @param array   $values Submitted values keyed by field key.
	 * @return array<string,bool> Field key => visible.
	 */
	public static function visibility( array $fields, array $values ) {
		$visible         = array();
		$section_visible = true;

		foreach ( $fields as $field ) {
			$own = self::passes( $field['conditions'] ?? array(), $values, $visible );

			if ( 'section' === $field['type'] ) {
				$section_visible          = $own;
				$visible[ $field['key'] ] = $own;
				continue;
			}

			$visible[ $field['key'] ] = $section_visible && $own;
		}

		return $visible;
	}

	/**
	 * Whether a field's own conditions allow it to be shown.
	 *
	 * @param array $conditions Conditions block.
	 * @param array $values     Values.
	 * @param array $visible    Visibility computed so far.
	 * @return bool
	 */
	private static function passes( array $conditions, array $values, array $visible ) {
		if ( empty( $conditions['enabled'] ) || empty( $conditions['rules'] ) ) {
			return true;
		}

		$results = array();
		foreach ( $conditions['rules'] as $rule ) {
			$key   = $rule['field'];
			$value = ( isset( $visible[ $key ] ) && false === $visible[ $key ] ) ? '' : ( $values[ $key ] ?? '' );

			$results[] = self::rule( $rule['operator'], $value, (string) ( $rule['value'] ?? '' ) );
		}

		$matched = ( $conditions['match'] ?? 'all' ) === 'any' ? in_array( true, $results, true ) : ! in_array( false, $results, true );

		return ( $conditions['action'] ?? 'show' ) === 'hide' ? ! $matched : $matched;
	}

	/**
	 * Evaluate a single rule.
	 *
	 * @param string       $operator Operator.
	 * @param string|array $actual   Field value.
	 * @param string       $expected Rule value.
	 * @return bool
	 */
	public static function rule( $operator, $actual, $expected ) {
		$expected = self::norm( $expected );

		if ( is_array( $actual ) ) {
			$list = array_values( array_filter( array_map( array( __CLASS__, 'norm' ), $actual ), 'strlen' ) );
			switch ( $operator ) {
				case 'equals':
				case 'contains':
					return in_array( $expected, $list, true );
				case 'not_equals':
				case 'not_contains':
					return ! in_array( $expected, $list, true );
				case 'empty':
					return 0 === count( $list );
				case 'not_empty':
					return count( $list ) > 0;
				case 'in':
					return (bool) array_intersect( $list, self::split( $expected ) );
				default:
					return false;
			}
		}

		$actual = self::norm( $actual );
		switch ( $operator ) {
			case 'equals':
				return $actual === $expected;
			case 'not_equals':
				return $actual !== $expected;
			case 'contains':
				return '' !== $expected && false !== strpos( $actual, $expected );
			case 'not_contains':
				return '' === $expected || false === strpos( $actual, $expected );
			case 'empty':
				return '' === $actual;
			case 'not_empty':
				return '' !== $actual;
			case 'gt':
				return is_numeric( $actual ) && is_numeric( $expected ) && (float) $actual > (float) $expected;
			case 'lt':
				return is_numeric( $actual ) && is_numeric( $expected ) && (float) $actual < (float) $expected;
			case 'in':
				return in_array( $actual, self::split( $expected ), true );
			default:
				return false;
		}
	}

	/**
	 * Normalise a scalar for comparison.
	 *
	 * @param mixed $value Value.
	 * @return string
	 */
	private static function norm( $value ) {
		return function_exists( 'mb_strtolower' ) ? mb_strtolower( trim( (string) $value ) ) : strtolower( trim( (string) $value ) );
	}

	/**
	 * Split a comma separated list.
	 *
	 * @param string $value List.
	 * @return string[]
	 */
	private static function split( $value ) {
		return array_values( array_filter( array_map( 'trim', explode( ',', $value ) ), 'strlen' ) );
	}
}
