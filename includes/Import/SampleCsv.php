<?php
/**
 * Sample CSV generator.
 *
 * @package ContactSync
 */

namespace ContactSync\Import;

use ContactSync\Forms\ConditionEvaluator;
use ContactSync\Forms\FormSchema;

defined( 'ABSPATH' ) || exit;

/**
 * Builds a CSV template with two example rows from the current form fields.
 */
class SampleCsv {

	/**
	 * Example values by CRM attribute.
	 *
	 * @var array
	 */
	private static $examples = array(
		'firstname'     => array( 'Jane', 'Rahul' ),
		'lastname'      => array( 'Cooper', 'Sharma' ),
		'emailaddress1' => array( 'jane.cooper@example.com', 'rahul.sharma@example.org' ),
		'telephone1'    => array( '+1 555 0100', '+44 20 7946 0958' ),
		'mobilephone'   => array( '+1 555 0101', '+44 7700 900123' ),
		'companyname'   => array( 'Northwind Traders', 'Contoso Ltd' ),
		'jobtitle'      => array( 'Operations Manager', 'Head of Procurement' ),
		'address1_city' => array( 'Chicago', 'London' ),
		'description'   => array( 'Met at the regional trade show.', 'Referred by an existing customer.' ),
	);

	/**
	 * Header row and example rows.
	 *
	 * @param array $schema Form schema.
	 * @return array{headers: string[], rows: array[]}
	 */
	public static function rows( array $schema ) {
		$fields  = FormSchema::visible_input_fields( $schema );
		$headers = wp_list_pluck( $fields, 'key' );
		$rows    = array();

		for ( $i = 0; $i < 2; $i++ ) {
			$values = array();
			foreach ( $fields as $field ) {
				$values[ $field['key'] ] = self::example( $field, $i );
			}
			$visible = ConditionEvaluator::visibility( $schema['fields'], self::comparable( $fields, $values ) );
			$row     = array();
			foreach ( $fields as $field ) {
				$row[] = ! empty( $visible[ $field['key'] ] ) ? $values[ $field['key'] ] : '';
			}
			$rows[] = $row;
		}

		return array(
			'headers' => $headers,
			'rows'    => $rows,
		);
	}

	/**
	 * CSV string.
	 *
	 * @param array $schema Form schema.
	 * @return string
	 */
	public static function build( array $schema ) {
		$data   = self::rows( $schema );
		$handle = fopen( 'php://temp', 'r+' ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fopen
		fputcsv( $handle, $data['headers'], ',', '"', '' );
		foreach ( $data['rows'] as $row ) {
			fputcsv( $handle, $row, ',', '"', '' );
		}
		rewind( $handle );
		$csv = stream_get_contents( $handle );
		fclose( $handle ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose
		return "\xEF\xBB\xBF" . $csv;
	}

	/**
	 * Example cell for a field.
	 *
	 * @param array $field Field.
	 * @param int   $i     Row index (0 or 1).
	 * @return string
	 */
	private static function example( array $field, $i ) {
		$attr = $field['crm']['attribute'] ?? '';
		if ( isset( self::$examples[ $attr ] ) ) {
			return self::$examples[ $attr ][ $i ];
		}

		$options = $field['options'] ?? array();
		switch ( $field['type'] ) {
			case 'email':
				return array( 'jane.cooper@example.com', 'rahul.sharma@example.org' )[ $i ];
			case 'phone':
				return array( '+1 555 0100', '+44 20 7946 0958' )[ $i ];
			case 'number':
				$min = $field['validation']['min'] ?? 0;
				return (string) ( max( (float) $min, 10 ) * ( $i + 1 ) );
			case 'date':
				return gmdate( 'Y-m-d', time() + ( $i * 7 * DAY_IN_SECONDS ) );
			case 'url':
				return array( 'https://www.example.com', 'https://www.example.org' )[ $i ];
			case 'checkbox':
				return 0 === $i ? 'yes' : 'no';
			case 'select':
			case 'radio':
				if ( ! $options ) {
					return '';
				}
				// Second row picks the last option so conditional examples show both paths.
				return 0 === $i ? $options[0]['label'] : $options[ count( $options ) - 1 ]['label'];
			case 'checkboxes':
				return implode( '; ', array_slice( wp_list_pluck( $options, 'label' ), $i, 2 ) );
			case 'textarea':
				return array( 'Met at the regional trade show.', 'Referred by an existing customer.' )[ $i ];
			default:
				return '' !== $field['placeholder'] ? $field['placeholder'] : $field['label'] . ' ' . ( $i + 1 );
		}
	}

	/**
	 * Convert example labels to option values so conditions evaluate like a real import.
	 *
	 * @param array[] $fields Fields.
	 * @param array   $values Example values.
	 * @return array
	 */
	private static function comparable( array $fields, array $values ) {
		foreach ( $fields as $field ) {
			if ( empty( $field['options'] ) ) {
				continue;
			}
			$map   = wp_list_pluck( $field['options'], 'value', 'label' );
			$value = $values[ $field['key'] ];
			if ( 'checkboxes' === $field['type'] ) {
				$values[ $field['key'] ] = array_map(
					function ( $label ) use ( $map ) {
						return $map[ $label ] ?? $label;
					},
					array_filter( array_map( 'trim', explode( ';', $value ) ) )
				);
			} else {
				$values[ $field['key'] ] = $map[ $value ] ?? $value;
			}
		}
		return $values;
	}
}
