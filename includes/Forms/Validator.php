<?php
/**
 * Server-side submission validation.
 *
 * @package ContactSync
 */

namespace ContactSync\Forms;

defined( 'ABSPATH' ) || exit;

/**
 * Validates and sanitises submitted values against a form schema.
 */
class Validator {

	const TEXT_MAX     = 500;
	const TEXTAREA_MAX = 5000;

	/**
	 * Validate a submission.
	 *
	 * @param array $schema  Form schema.
	 * @param array $input   Raw values keyed by field key.
	 * @param bool  $lenient CSV mode: accept option labels, "yes"/"no" checkboxes and "a; b" lists.
	 * @return array{values: array, errors: array<string,string>}
	 */
	public static function validate( array $schema, array $input, $lenient = false ) {
		$fields = $schema['fields'] ?? array();

		// Normalise first so conditions are evaluated on the same values that get stored.
		$normalised = array();
		foreach ( FormSchema::input_fields( $schema ) as $field ) {
			$raw = array_key_exists( $field['key'], $input ) ? $input[ $field['key'] ] : null;
			if ( 'hidden' === $field['type'] && ( null === $raw || '' === $raw ) ) {
				$raw = $field['default'] ?? '';
			}
			$normalised[ $field['key'] ] = self::normalise( $field, $raw, $lenient );
		}

		$visible = ConditionEvaluator::visibility( $fields, $normalised );
		$values  = array();
		$errors  = array();

		foreach ( FormSchema::input_fields( $schema ) as $field ) {
			$key = $field['key'];
			if ( empty( $visible[ $key ] ) ) {
				continue;
			}
			$value = $normalised[ $key ];
			$error = self::check( $field, $value );
			if ( $error ) {
				$errors[ $key ] = $error;
			}
			$values[ $key ] = $value;
		}

		return array(
			'values' => $values,
			'errors' => $errors,
		);
	}

	/**
	 * Sanitise a raw value into its stored shape.
	 *
	 * @param array $field   Field.
	 * @param mixed $raw     Raw value.
	 * @param bool  $lenient CSV mode.
	 * @return string|string[]
	 */
	private static function normalise( array $field, $raw, $lenient ) {
		switch ( $field['type'] ) {
			case 'checkboxes':
				if ( is_string( $raw ) ) {
					$raw = '' === trim( $raw ) ? array() : preg_split( '/\s*[;|]\s*/', trim( $raw ) );
				}
				$list = array();
				foreach ( (array) $raw as $item ) {
					$item = sanitize_text_field( is_scalar( $item ) ? (string) $item : '' );
					if ( '' !== $item ) {
						$list[] = $lenient ? self::match_option( $field, $item ) : $item;
					}
				}
				return array_values( array_unique( $list ) );

			case 'checkbox':
				if ( is_bool( $raw ) ) {
					return $raw ? '1' : '';
				}
				$raw = strtolower( trim( is_scalar( $raw ) ? (string) $raw : '' ) );
				return in_array( $raw, array( '1', 'yes', 'y', 'true', 'on', 'x', 'checked' ), true ) ? '1' : '';

			case 'select':
			case 'radio':
				$value = sanitize_text_field( is_scalar( $raw ) ? (string) $raw : '' );
				return $lenient && '' !== $value ? self::match_option( $field, $value ) : $value;

			case 'textarea':
				return sanitize_textarea_field( is_scalar( $raw ) ? (string) $raw : '' );

			case 'email':
				return strtolower( sanitize_text_field( is_scalar( $raw ) ? (string) $raw : '' ) );

			case 'url':
				$value = trim( is_scalar( $raw ) ? (string) $raw : '' );
				if ( '' !== $value && ! preg_match( '#^[a-z][a-z0-9+.-]*://#i', $value ) ) {
					$value = 'https://' . $value;
				}
				return '' === $value ? '' : esc_url_raw( $value );

			case 'number':
				$value = trim( is_scalar( $raw ) ? (string) $raw : '' );
				return str_replace( array( ',', ' ' ), '', $value );

			case 'date':
				$value = trim( is_scalar( $raw ) ? (string) $raw : '' );
				if ( $lenient && '' !== $value && ! preg_match( '/^\d{4}-\d{2}-\d{2}$/', $value ) ) {
					$time = strtotime( $value );
					if ( $time ) {
						$value = gmdate( 'Y-m-d', $time );
					}
				}
				return $value;

			default:
				return sanitize_text_field( is_scalar( $raw ) ? (string) $raw : '' );
		}
	}

	/**
	 * Validate a normalised value. Returns an error message or empty string.
	 *
	 * @param array           $field Field.
	 * @param string|string[] $value Value.
	 * @return string
	 */
	private static function check( array $field, $value ) {
		$label = '' !== $field['label'] ? $field['label'] : $field['key'];
		$empty = is_array( $value ) ? 0 === count( $value ) : '' === $value;
		$rules = $field['validation'] ?? array();

		if ( $empty ) {
			/* translators: %s: field label */
			return ! empty( $field['required'] ) ? sprintf( __( '%s is required.', 'contact-sync' ), $label ) : '';
		}

		switch ( $field['type'] ) {
			case 'email':
				if ( ! is_email( $value ) ) {
					return __( 'Enter a valid email address.', 'contact-sync' );
				}
				break;
			case 'phone':
				if ( ! preg_match( '/^\+?[0-9().\-\s]{5,25}(\s*(x|ext\.?)\s*[0-9]{1,6})?$/i', $value ) ) {
					return __( 'Enter a valid phone number.', 'contact-sync' );
				}
				break;
			case 'url':
				if ( ! wp_http_validate_url( $value ) && ! filter_var( $value, FILTER_VALIDATE_URL ) ) {
					return __( 'Enter a valid URL.', 'contact-sync' );
				}
				break;
			case 'number':
				if ( ! is_numeric( $value ) ) {
					return __( 'Enter a number.', 'contact-sync' );
				}
				if ( isset( $rules['min'] ) && (float) $value < (float) $rules['min'] ) {
					/* translators: %s: minimum */
					return sprintf( __( 'Must be at least %s.', 'contact-sync' ), $rules['min'] );
				}
				if ( isset( $rules['max'] ) && (float) $value > (float) $rules['max'] ) {
					/* translators: %s: maximum */
					return sprintf( __( 'Must be at most %s.', 'contact-sync' ), $rules['max'] );
				}
				break;
			case 'date':
				$parts = explode( '-', $value );
				if ( 3 !== count( $parts ) || ! checkdate( (int) $parts[1], (int) $parts[2], (int) $parts[0] ) ) {
					return __( 'Enter a valid date (YYYY-MM-DD).', 'contact-sync' );
				}
				break;
			case 'select':
			case 'radio':
				if ( ! in_array( $value, self::option_values( $field ), true ) ) {
					return __( 'Choose one of the available options.', 'contact-sync' );
				}
				break;
			case 'checkboxes':
				if ( array_diff( $value, self::option_values( $field ) ) ) {
					return __( 'Choose from the available options.', 'contact-sync' );
				}
				break;
		}

		if ( is_string( $value ) && in_array( $field['type'], array( 'text', 'textarea', 'email', 'phone', 'url', 'hidden' ), true ) ) {
			$length = function_exists( 'mb_strlen' ) ? mb_strlen( $value ) : strlen( $value );
			$max    = 'textarea' === $field['type'] ? self::TEXTAREA_MAX : self::TEXT_MAX;
			if ( isset( $rules['maxLength'] ) ) {
				$max = min( $max, (int) $rules['maxLength'] );
			}
			if ( isset( $rules['minLength'] ) && $length < (int) $rules['minLength'] ) {
				/* translators: %d: characters */
				return sprintf( __( 'Must be at least %d characters.', 'contact-sync' ), (int) $rules['minLength'] );
			}
			if ( $length > $max ) {
				/* translators: %d: characters */
				return sprintf( __( 'Must be %d characters or fewer.', 'contact-sync' ), $max );
			}
			if ( ! empty( $rules['pattern'] ) && ! preg_match( FormSchema::pattern_regex( $rules['pattern'] ), $value ) ) {
				return ! empty( $rules['patternMessage'] ) ? $rules['patternMessage'] : __( 'Value is not in the expected format.', 'contact-sync' );
			}
		}

		return '';
	}

	/**
	 * Option values of a choice field.
	 *
	 * @param array $field Field.
	 * @return string[]
	 */
	private static function option_values( array $field ) {
		return array_map( 'strval', wp_list_pluck( $field['options'] ?? array(), 'value' ) );
	}

	/**
	 * Map a CSV cell to an option value by value or label (case-insensitive).
	 *
	 * @param array  $field Field.
	 * @param string $input Cell value.
	 * @return string Matching option value, or the input unchanged.
	 */
	private static function match_option( array $field, $input ) {
		$needle = strtolower( trim( $input ) );
		foreach ( $field['options'] ?? array() as $option ) {
			if ( strtolower( $option['value'] ) === $needle || strtolower( $option['label'] ) === $needle ) {
				return $option['value'];
			}
		}
		return $input;
	}
}
