<?php
/**
 * Submission to Lead payload mapping.
 *
 * @package ContactSync
 */

namespace ContactSync\Crm;

use ContactSync\Forms\FormSchema;
use ContactSync\Support\Mailer;
use ContactSync\Support\Settings;

defined( 'ABSPATH' ) || exit;

/**
 * Builds the Dynamics Lead payload from a submission and the form's CRM mappings.
 */
class LeadMapper {

	const DESCRIPTION_MAX = 2000;

	/**
	 * Build the payload.
	 *
	 * @param array $schema  Form schema (current version, holds the mappings).
	 * @param array $values  Submitted values.
	 * @param array $context rep_name, rep_email, agency_name (null for independent), product.
	 * @return array
	 */
	public static function map( array $schema, array $values, array $context ) {
		$sync     = Settings::get( 'sync', array() );
		$payload  = array();
		$unmapped = array();

		foreach ( FormSchema::input_fields( $schema ) as $field ) {
			$key = $field['key'];
			if ( ! array_key_exists( $key, $values ) || self::is_empty( $values[ $key ] ) ) {
				continue;
			}
			$attribute = $field['crm']['attribute'] ?? '';
			$type      = $field['crm']['type'] ?? 'string';

			if ( '' === $attribute ) {
				$unmapped[] = ( '' !== $field['label'] ? $field['label'] : $key ) . ': ' . self::display( $field, $values[ $key ] );
				continue;
			}

			$value = self::cast( $field, $values[ $key ], $type );
			if ( null === $value ) {
				continue;
			}
			if ( isset( $payload[ $attribute ] ) && is_string( $payload[ $attribute ] ) && is_string( $value ) ) {
				$payload[ $attribute ] .= "\n" . $value;
			} else {
				$payload[ $attribute ] = $value;
			}
		}

		foreach ( $schema['settings']['staticValues'] ?? array() as $static ) {
			if ( ! isset( $payload[ $static['attribute'] ] ) ) {
				$value = self::cast_scalar( $static['value'], $static['type'] );
				if ( null !== $value ) {
					$payload[ $static['attribute'] ] = $value;
				}
			}
		}

		$agency = $context['agency_name'] ? $context['agency_name'] : __( 'Independent', 'contact-sync' );
		$vars   = array(
			'agency'  => $agency,
			'rep'     => $context['rep_name'],
			'email'   => $payload['emailaddress1'] ?? '',
			'company' => $payload['companyname'] ?? '',
			'name'    => trim( ( $payload['firstname'] ?? '' ) . ' ' . ( $payload['lastname'] ?? '' ) ),
		);

		if ( ! empty( $sync['agency_attribute'] ) ) {
			$payload[ $sync['agency_attribute'] ] = $agency;
		}
		if ( ! empty( $sync['rep_attribute'] ) ) {
			$payload[ $sync['rep_attribute'] ] = $context['rep_name'];
		}
		if ( ! empty( $sync['rep_email_attr'] ) ) {
			$payload[ $sync['rep_email_attr'] ] = $context['rep_email'];
		}

		if ( empty( $payload['subject'] ) ) {
			$template           = ! empty( $sync['subject_template'] ) ? $sync['subject_template'] : 'Lead from {agency} - {rep}';
			$payload['subject'] = trim( Mailer::replace( $template, $vars ), " -\t" );
		}

		// Dynamics requires a last name on leads.
		if ( empty( $payload['lastname'] ) && empty( $payload['fullname'] ) ) {
			$payload['lastname'] = $vars['company'] ? $vars['company'] : ( $vars['email'] ? $vars['email'] : __( 'Unknown', 'contact-sync' ) );
		}

		if ( ! empty( $sync['append_to_notes'] ) ) {
			$notes = array();
			if ( $unmapped ) {
				$notes[] = implode( "\n", $unmapped );
			}
			$notes[] = sprintf(
				/* translators: 1: product name, 2: rep name, 3: rep email, 4: agency */
				__( 'Submitted via %1$s by %2$s (%3$s), %4$s.', 'contact-sync' ),
				$context['product'],
				$context['rep_name'],
				$context['rep_email'],
				$agency
			);
			$existing               = isset( $payload['description'] ) && is_string( $payload['description'] ) ? $payload['description'] . "\n\n" : '';
			$payload['description'] = $existing . implode( "\n\n", $notes );
		}

		if ( isset( $payload['description'] ) && is_string( $payload['description'] ) ) {
			$payload['description'] = function_exists( 'mb_substr' ) ? mb_substr( $payload['description'], 0, self::DESCRIPTION_MAX ) : substr( $payload['description'], 0, self::DESCRIPTION_MAX );
		}

		return apply_filters( 'contact_sync_lead_payload', $payload, $schema, $values, $context );
	}

	/**
	 * Cast a field value to the attribute type.
	 *
	 * Choice fields send the option label to text attributes and the option value to numeric
	 * (option set) attributes.
	 *
	 * @param array           $field Field.
	 * @param string|string[] $value Value.
	 * @param string          $type  Attribute type.
	 * @return mixed
	 */
	private static function cast( array $field, $value, $type ) {
		if ( 'checkbox' === $field['type'] ) {
			if ( 'bool' === $type ) {
				return '1' === $value;
			}
			return '1' === $value ? __( 'Yes', 'contact-sync' ) : __( 'No', 'contact-sync' );
		}
		if ( 'string' === $type ) {
			return self::display( $field, $value );
		}
		if ( is_array( $value ) ) {
			$value = reset( $value );
		}
		return self::cast_scalar( $value, $type );
	}

	/**
	 * Cast a scalar.
	 *
	 * @param string $value Value.
	 * @param string $type  string|int|decimal|bool.
	 * @return mixed Null when the value cannot be cast.
	 */
	private static function cast_scalar( $value, $type ) {
		switch ( $type ) {
			case 'int':
				return is_numeric( $value ) ? (int) $value : null;
			case 'decimal':
				return is_numeric( $value ) ? (float) $value : null;
			case 'bool':
				return in_array( strtolower( (string) $value ), array( '1', 'true', 'yes', 'y', 'on' ), true );
			default:
				return (string) $value;
		}
	}

	/**
	 * Human readable value (option labels, joined lists).
	 *
	 * @param array           $field Field.
	 * @param string|string[] $value Value.
	 * @return string
	 */
	public static function display( array $field, $value ) {
		$labels = wp_list_pluck( $field['options'] ?? array(), 'label', 'value' );
		if ( is_array( $value ) ) {
			return implode(
				'; ',
				array_map(
					function ( $v ) use ( $labels ) {
						return $labels[ $v ] ?? $v;
					},
					$value
				)
			);
		}
		if ( 'checkbox' === $field['type'] ) {
			return '1' === $value ? __( 'Yes', 'contact-sync' ) : __( 'No', 'contact-sync' );
		}
		return (string) ( $labels[ $value ] ?? $value );
	}

	/**
	 * Whether a value is empty.
	 *
	 * @param mixed $value Value.
	 * @return bool
	 */
	private static function is_empty( $value ) {
		return is_array( $value ) ? 0 === count( $value ) : '' === (string) $value;
	}
}
