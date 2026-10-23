<?php
/**
 * Form schema definition and sanitisation.
 *
 * @package ContactSync
 */

namespace ContactSync\Forms;

use ContactSync\Support\Settings;

defined( 'ABSPATH' ) || exit;

/**
 * Describes field types, CRM attributes and the starter form, and cleans schemas from the builder.
 */
class FormSchema {

	const INPUT_TYPES  = array( 'text', 'email', 'phone', 'number', 'textarea', 'select', 'radio', 'checkboxes', 'checkbox', 'date', 'url', 'hidden' );
	const LAYOUT_TYPES = array( 'section', 'divider' );
	const CHOICE_TYPES = array( 'select', 'radio', 'checkboxes' );
	const OPERATORS    = array( 'equals', 'not_equals', 'contains', 'not_contains', 'empty', 'not_empty', 'gt', 'lt', 'in' );

	/**
	 * Commonly used Dynamics 365 Lead attributes offered in the mapping dropdown.
	 *
	 * @return array[] Each: attribute, label, type.
	 */
	public static function crm_attributes() {
		$list = array(
			array( 'firstname', __( 'First Name', 'contact-sync' ), 'string' ),
			array( 'lastname', __( 'Last Name', 'contact-sync' ), 'string' ),
			array( 'fullname', __( 'Full Name (read-only in most orgs)', 'contact-sync' ), 'string' ),
			array( 'emailaddress1', __( 'Email', 'contact-sync' ), 'string' ),
			array( 'emailaddress2', __( 'Email Address 2', 'contact-sync' ), 'string' ),
			array( 'telephone1', __( 'Business Phone', 'contact-sync' ), 'string' ),
			array( 'mobilephone', __( 'Mobile Phone', 'contact-sync' ), 'string' ),
			array( 'companyname', __( 'Company Name', 'contact-sync' ), 'string' ),
			array( 'jobtitle', __( 'Job Title', 'contact-sync' ), 'string' ),
			array( 'websiteurl', __( 'Website', 'contact-sync' ), 'string' ),
			array( 'subject', __( 'Topic', 'contact-sync' ), 'string' ),
			array( 'description', __( 'Description', 'contact-sync' ), 'string' ),
			array( 'address1_line1', __( 'Street 1', 'contact-sync' ), 'string' ),
			array( 'address1_line2', __( 'Street 2', 'contact-sync' ), 'string' ),
			array( 'address1_city', __( 'City', 'contact-sync' ), 'string' ),
			array( 'address1_stateorprovince', __( 'State/Province', 'contact-sync' ), 'string' ),
			array( 'address1_postalcode', __( 'ZIP/Postal Code', 'contact-sync' ), 'string' ),
			array( 'address1_country', __( 'Country/Region', 'contact-sync' ), 'string' ),
			array( 'numberofemployees', __( 'No. of Employees', 'contact-sync' ), 'int' ),
			array( 'revenue', __( 'Annual Revenue', 'contact-sync' ), 'decimal' ),
			array( 'budgetamount', __( 'Budget Amount', 'contact-sync' ), 'decimal' ),
			array( 'leadsourcecode', __( 'Lead Source (option set value)', 'contact-sync' ), 'int' ),
			array( 'industrycode', __( 'Industry (option set value)', 'contact-sync' ), 'int' ),
			array( 'leadqualitycode', __( 'Rating (option set value)', 'contact-sync' ), 'int' ),
			array( 'purchasetimeframe', __( 'Purchase Timeframe (option set value)', 'contact-sync' ), 'int' ),
			array( 'donotemail', __( 'Do Not Allow Emails', 'contact-sync' ), 'bool' ),
			array( 'donotphone', __( 'Do Not Allow Phone Calls', 'contact-sync' ), 'bool' ),
		);

		return array_map(
			function ( $row ) {
				return array(
					'attribute' => $row[0],
					'label'     => $row[1],
					'type'      => $row[2],
				);
			},
			apply_filters( 'contact_sync_crm_attributes', $list )
		);
	}

	/**
	 * Fields that collect a value (excludes sections and dividers).
	 *
	 * @param array $schema Schema.
	 * @return array[]
	 */
	public static function input_fields( array $schema ) {
		return array_values(
			array_filter(
				$schema['fields'] ?? array(),
				function ( $field ) {
					return in_array( $field['type'], self::INPUT_TYPES, true );
				}
			)
		);
	}

	/**
	 * Schema as sent to the portal: CRM column mappings and fixed CRM values removed,
	 * since reps only need what to fill in.
	 *
	 * @param array $schema Schema.
	 * @return array
	 */
	public static function for_portal( array $schema ) {
		unset( $schema['settings']['staticValues'] );
		foreach ( $schema['fields'] ?? array() as $i => $field ) {
			unset( $schema['fields'][ $i ]['crm'] );
		}
		return $schema;
	}

	/**
	 * Fields a rep fills in (input fields minus hidden ones). Used for CSV templates.
	 *
	 * @param array $schema Schema.
	 * @return array[]
	 */
	public static function visible_input_fields( array $schema ) {
		return array_values(
			array_filter(
				self::input_fields( $schema ),
				function ( $field ) {
					return 'hidden' !== $field['type'];
				}
			)
		);
	}

	/**
	 * Default form created on activation.
	 *
	 * @return array
	 */
	public static function starter() {
		$f = function ( $type, $key, $label, $extra = array() ) {
			return array_merge(
				array(
					'id'       => 'f_' . $key,
					'type'     => $type,
					'key'      => $key,
					'label'    => $label,
					'required' => false,
					'width'    => 'full',
				),
				$extra
			);
		};

		return self::sanitize(
			array(
				'settings' => array(
					'submitLabel'    => __( 'Submit lead', 'contact-sync' ),
					'successMessage' => __( 'Thanks! Your lead has been submitted and is being sent to the sales team.', 'contact-sync' ),
					'staticValues'   => array(),
				),
				'fields'   => array(
					$f( 'section', 'contact_section', __( 'Contact details', 'contact-sync' ), array( 'description' => __( 'Who should the sales team get in touch with?', 'contact-sync' ) ) ),
					$f( 'text', 'first_name', __( 'First name', 'contact-sync' ), array( 'required' => true, 'width' => 'half', 'crm' => array( 'attribute' => 'firstname' ) ) ), // phpcs:ignore WordPress.Arrays.ArrayDeclarationSpacing.AssociativeArrayFound
					$f( 'text', 'last_name', __( 'Last name', 'contact-sync' ), array( 'required' => true, 'width' => 'half', 'crm' => array( 'attribute' => 'lastname' ) ) ), // phpcs:ignore WordPress.Arrays.ArrayDeclarationSpacing.AssociativeArrayFound
					$f( 'email', 'email', __( 'Email', 'contact-sync' ), array( 'required' => true, 'width' => 'half', 'crm' => array( 'attribute' => 'emailaddress1' ) ) ), // phpcs:ignore WordPress.Arrays.ArrayDeclarationSpacing.AssociativeArrayFound
					$f( 'phone', 'phone', __( 'Phone', 'contact-sync' ), array( 'width' => 'half', 'crm' => array( 'attribute' => 'telephone1' ) ) ), // phpcs:ignore WordPress.Arrays.ArrayDeclarationSpacing.AssociativeArrayFound
					$f( 'text', 'company', __( 'Company', 'contact-sync' ), array( 'required' => true, 'width' => 'half', 'crm' => array( 'attribute' => 'companyname' ) ) ), // phpcs:ignore WordPress.Arrays.ArrayDeclarationSpacing.AssociativeArrayFound
					$f( 'text', 'job_title', __( 'Job title', 'contact-sync' ), array( 'width' => 'half', 'crm' => array( 'attribute' => 'jobtitle' ) ) ), // phpcs:ignore WordPress.Arrays.ArrayDeclarationSpacing.AssociativeArrayFound
					$f( 'section', 'opportunity_section', __( 'Opportunity', 'contact-sync' ) ),
					$f(
						'select',
						'interest',
						__( 'Interested in', 'contact-sync' ),
						array(
							'required' => true,
							'width'    => 'half',
							'options'  => array(
								array( 'label' => __( 'New installation', 'contact-sync' ), 'value' => 'new' ), // phpcs:ignore WordPress.Arrays.ArrayDeclarationSpacing.AssociativeArrayFound
								array( 'label' => __( 'Upgrade', 'contact-sync' ), 'value' => 'upgrade' ), // phpcs:ignore WordPress.Arrays.ArrayDeclarationSpacing.AssociativeArrayFound
								array( 'label' => __( 'Service contract', 'contact-sync' ), 'value' => 'service' ), // phpcs:ignore WordPress.Arrays.ArrayDeclarationSpacing.AssociativeArrayFound
								array( 'label' => __( 'Other', 'contact-sync' ), 'value' => 'other' ), // phpcs:ignore WordPress.Arrays.ArrayDeclarationSpacing.AssociativeArrayFound
							),
						)
					),
					$f(
						'text',
						'interest_other',
						__( 'Please specify', 'contact-sync' ),
						array(
							'required'   => true,
							'width'      => 'half',
							'conditions' => array(
								'enabled' => true,
								'action'  => 'show',
								'match'   => 'all',
								'rules'   => array(
									array(
										'field'    => 'interest',
										'operator' => 'equals',
										'value'    => 'other',
									),
								),
							),
						)
					),
					$f(
						'radio',
						'timeframe',
						__( 'Purchase timeframe', 'contact-sync' ),
						array(
							'options' => array(
								array( 'label' => __( 'Immediately', 'contact-sync' ), 'value' => 'immediate' ), // phpcs:ignore WordPress.Arrays.ArrayDeclarationSpacing.AssociativeArrayFound
								array( 'label' => __( 'This quarter', 'contact-sync' ), 'value' => 'quarter' ), // phpcs:ignore WordPress.Arrays.ArrayDeclarationSpacing.AssociativeArrayFound
								array( 'label' => __( 'This year', 'contact-sync' ), 'value' => 'year' ), // phpcs:ignore WordPress.Arrays.ArrayDeclarationSpacing.AssociativeArrayFound
								array( 'label' => __( 'Unknown', 'contact-sync' ), 'value' => 'unknown' ), // phpcs:ignore WordPress.Arrays.ArrayDeclarationSpacing.AssociativeArrayFound
							),
						)
					),
					$f( 'textarea', 'notes', __( 'Notes', 'contact-sync' ), array( 'placeholder' => __( 'Anything the sales team should know', 'contact-sync' ), 'crm' => array( 'attribute' => 'description' ) ) ), // phpcs:ignore WordPress.Arrays.ArrayDeclarationSpacing.AssociativeArrayFound
				),
			)
		);
	}

	/**
	 * Clean a schema coming from the builder.
	 *
	 * @param array $schema Raw schema.
	 * @return array
	 */
	public static function sanitize( array $schema ) {
		$settings = (array) ( $schema['settings'] ?? array() );
		$clean    = array(
			'settings' => array(
				'submitLabel'    => sanitize_text_field( $settings['submitLabel'] ?? __( 'Submit', 'contact-sync' ) ),
				'successMessage' => sanitize_textarea_field( $settings['successMessage'] ?? '' ),
				'staticValues'   => array(),
			),
			'fields'   => array(),
		);

		foreach ( (array) ( $settings['staticValues'] ?? array() ) as $row ) {
			$attribute = Settings::logical_name( $row['attribute'] ?? '' );
			if ( '' !== $attribute ) {
				$clean['settings']['staticValues'][] = array(
					'attribute' => $attribute,
					'value'     => sanitize_text_field( $row['value'] ?? '' ),
					'type'      => self::attr_type( $row['type'] ?? 'string' ),
				);
			}
		}

		$keys = array();
		foreach ( (array) ( $schema['fields'] ?? array() ) as $index => $field ) {
			$type = $field['type'] ?? '';
			if ( ! in_array( $type, array_merge( self::INPUT_TYPES, self::LAYOUT_TYPES ), true ) ) {
				continue;
			}

			$key = sanitize_key( $field['key'] ?? '' );
			if ( '' === $key ) {
				$key = $type . '_' . ( $index + 1 );
			}
			$base = $key;
			$n    = 2;
			while ( isset( $keys[ $key ] ) ) {
				$key = $base . '_' . $n;
				++$n;
			}
			$keys[ $key ] = true;

			$item = array(
				'id'         => sanitize_key( $field['id'] ?? '' ) ? sanitize_key( $field['id'] ) : 'f_' . $key,
				'type'       => $type,
				'key'        => $key,
				'label'      => sanitize_text_field( $field['label'] ?? '' ),
				'width'      => ( $field['width'] ?? 'full' ) === 'half' ? 'half' : 'full',
				'conditions' => self::sanitize_conditions( $field['conditions'] ?? array() ),
			);

			if ( in_array( $type, self::LAYOUT_TYPES, true ) ) {
				$item['description'] = sanitize_textarea_field( $field['description'] ?? '' );
				$item['width']       = 'full';
				$clean['fields'][]   = $item;
				continue;
			}

			$item['placeholder'] = sanitize_text_field( $field['placeholder'] ?? '' );
			$item['help']        = sanitize_text_field( $field['help'] ?? '' );
			$item['default']     = is_array( $field['default'] ?? null ) ? array_map( 'sanitize_text_field', $field['default'] ) : sanitize_text_field( $field['default'] ?? '' );
			$item['required']    = ! empty( $field['required'] ) && 'hidden' !== $type;

			if ( in_array( $type, self::CHOICE_TYPES, true ) ) {
				$item['options'] = array();
				foreach ( (array) ( $field['options'] ?? array() ) as $option ) {
					$label = sanitize_text_field( $option['label'] ?? '' );
					$value = sanitize_text_field( $option['value'] ?? '' );
					if ( '' === $value ) {
						$value = sanitize_title( $label );
					}
					if ( '' !== $value ) {
						$item['options'][] = array(
							'label' => '' !== $label ? $label : $value,
							'value' => $value,
						);
					}
				}
			}

			$validation         = (array) ( $field['validation'] ?? array() );
			$item['validation'] = array();
			foreach ( array( 'min', 'max', 'minLength', 'maxLength' ) as $rule ) {
				if ( isset( $validation[ $rule ] ) && '' !== $validation[ $rule ] && is_numeric( $validation[ $rule ] ) ) {
					$item['validation'][ $rule ] = 0 + $validation[ $rule ];
				}
			}
			if ( ! empty( $validation['pattern'] ) && self::valid_pattern( $validation['pattern'] ) ) {
				$item['validation']['pattern']        = (string) $validation['pattern'];
				$item['validation']['patternMessage'] = sanitize_text_field( $validation['patternMessage'] ?? '' );
			}

			$crm         = (array) ( $field['crm'] ?? array() );
			$item['crm'] = array(
				'attribute' => Settings::logical_name( $crm['attribute'] ?? '' ),
				'type'      => self::attr_type( $crm['type'] ?? self::default_attr_type( $crm['attribute'] ?? '' ) ),
			);

			$clean['fields'][] = $item;
		}

		// Drop rules that reference fields which no longer exist.
		foreach ( $clean['fields'] as &$field ) {
			$field['conditions']['rules'] = array_values(
				array_filter(
					$field['conditions']['rules'],
					function ( $rule ) use ( $keys, $field ) {
						return isset( $keys[ $rule['field'] ] ) && $rule['field'] !== $field['key'];
					}
				)
			);
			if ( ! $field['conditions']['rules'] ) {
				$field['conditions']['enabled'] = false;
			}
		}
		unset( $field );

		return $clean;
	}

	/**
	 * Whether a user-supplied regex compiles.
	 *
	 * @param string $pattern Pattern without delimiters.
	 * @return bool
	 */
	public static function valid_pattern( $pattern ) {
		// phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged
		return false !== @preg_match( self::pattern_regex( $pattern ), '' );
	}

	/**
	 * Wrap a field pattern as a full-match PHP regex (same semantics as the HTML pattern attribute).
	 *
	 * @param string $pattern Pattern.
	 * @return string
	 */
	public static function pattern_regex( $pattern ) {
		return '~^(?:' . str_replace( '~', '\~', (string) $pattern ) . ')$~u';
	}

	/**
	 * Clean a conditions block.
	 *
	 * @param mixed $conditions Raw conditions.
	 * @return array
	 */
	private static function sanitize_conditions( $conditions ) {
		$conditions = (array) $conditions;
		$rules      = array();
		foreach ( (array) ( $conditions['rules'] ?? array() ) as $rule ) {
			$operator = $rule['operator'] ?? 'equals';
			$field    = sanitize_key( $rule['field'] ?? '' );
			if ( '' === $field || ! in_array( $operator, self::OPERATORS, true ) ) {
				continue;
			}
			$rules[] = array(
				'field'    => $field,
				'operator' => $operator,
				'value'    => sanitize_text_field( $rule['value'] ?? '' ),
			);
		}
		return array(
			'enabled' => ! empty( $conditions['enabled'] ) && ! empty( $rules ),
			'action'  => ( $conditions['action'] ?? 'show' ) === 'hide' ? 'hide' : 'show',
			'match'   => ( $conditions['match'] ?? 'all' ) === 'any' ? 'any' : 'all',
			'rules'   => $rules,
		);
	}

	/**
	 * Allowed CRM value types.
	 *
	 * @param string $type Raw type.
	 * @return string
	 */
	private static function attr_type( $type ) {
		return in_array( $type, array( 'string', 'int', 'decimal', 'bool' ), true ) ? $type : 'string';
	}

	/**
	 * Known type of a standard attribute.
	 *
	 * @param string $attribute Logical name.
	 * @return string
	 */
	private static function default_attr_type( $attribute ) {
		foreach ( self::crm_attributes() as $item ) {
			if ( $item['attribute'] === $attribute ) {
				return $item['type'];
			}
		}
		return 'string';
	}
}
