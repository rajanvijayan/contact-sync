<?php
/**
 * Plugin settings storage.
 *
 * @package ContactSync
 */

namespace ContactSync\Support;

defined( 'ABSPATH' ) || exit;

/**
 * Reads and writes the single settings option, merged with defaults.
 */
class Settings {

	const OPTION = 'contact_sync_settings';

	/**
	 * Default settings tree.
	 *
	 * @return array
	 */
	public static function defaults() {
		return array(
			'dynamics' => array(
				'org_url'       => '',
				'tenant_id'     => '',
				'client_id'     => '',
				'client_secret' => '',
				'api_version'   => '9.2',
			),
			'sync'     => array(
				'enabled'          => true,
				'max_attempts'     => 5,
				'duplicate_check'  => 'off',
				'agency_attribute' => '',
				'rep_attribute'    => '',
				'rep_email_attr'   => '',
				'subject_template' => 'Lead from {agency} - {rep}',
				'append_to_notes'  => true,
			),
			'branding' => array(
				'product_name'  => 'Lead Portal',
				'tagline'       => 'Submit and track your leads in one place.',
				'logo_url'      => '',
				'primary_color' => '#2563eb',
				'support_email' => '',
			),
			'security' => array(
				'login_attempts'   => 5,
				'lockout_minutes'  => 15,
				'match_subdomains' => false,
				'max_csv_rows'     => 1000,
				'max_csv_kb'       => 2048,
			),
			'emails'   => array(
				'from_name'      => '',
				'from_email'     => '',
				'verify_subject' => 'Confirm your email for {site}',
				'verify_body'    => "Hi {first_name},\n\nThanks for signing up. Please confirm your email address to activate your account.",
				'invite_subject' => 'You have been invited to {site}',
				'invite_body'    => "Hi {first_name},\n\nAn account has been created for you. Set your password to get started.",
				'reset_subject'  => 'Reset your {site} password',
				'reset_body'     => "Hi {first_name},\n\nWe received a request to reset your password. If this was not you, you can ignore this email.",
			),
		);
	}

	/**
	 * Full settings array (secret left encrypted).
	 *
	 * @return array
	 */
	public static function all() {
		$stored = get_option( self::OPTION, array() );
		return self::merge( self::defaults(), is_array( $stored ) ? $stored : array() );
	}

	/**
	 * Get a single section or value using dot notation, e.g. "sync.max_attempts".
	 *
	 * @param string $path    Dot path.
	 * @param mixed  $fallback Fallback.
	 * @return mixed
	 */
	public static function get( $path, $fallback = null ) {
		$value = self::all();
		foreach ( explode( '.', $path ) as $segment ) {
			if ( ! is_array( $value ) || ! array_key_exists( $segment, $value ) ) {
				return $fallback;
			}
			$value = $value[ $segment ];
		}
		return $value;
	}

	/**
	 * Decrypted Dynamics client secret.
	 *
	 * @return string
	 */
	public static function client_secret() {
		return Crypto::decrypt( (string) self::get( 'dynamics.client_secret', '' ) );
	}

	/**
	 * Whether the Dynamics connection has every required value.
	 *
	 * @return bool
	 */
	public static function dynamics_configured() {
		$d = self::get( 'dynamics', array() );
		return ! empty( $d['org_url'] ) && ! empty( $d['tenant_id'] ) && ! empty( $d['client_id'] ) && ! empty( $d['client_secret'] );
	}

	/**
	 * Sanitize and persist an incoming partial settings payload.
	 *
	 * @param array $input Raw input keyed by section.
	 * @return array Saved settings.
	 */
	public static function update( array $input ) {
		$current = self::all();
		$clean   = $current;

		if ( isset( $input['dynamics'] ) && is_array( $input['dynamics'] ) ) {
			$d = $input['dynamics'];
			foreach ( array( 'tenant_id', 'client_id', 'api_version' ) as $key ) {
				if ( isset( $d[ $key ] ) ) {
					$clean['dynamics'][ $key ] = sanitize_text_field( $d[ $key ] );
				}
			}
			if ( isset( $d['org_url'] ) ) {
				$clean['dynamics']['org_url'] = untrailingslashit( esc_url_raw( trim( $d['org_url'] ) ) );
			}
			// An empty secret means "keep the existing one"; the UI never receives the real value.
			if ( isset( $d['client_secret'] ) && '' !== trim( $d['client_secret'] ) ) {
				$clean['dynamics']['client_secret'] = Crypto::encrypt( trim( $d['client_secret'] ) );
			}
		}

		if ( isset( $input['sync'] ) && is_array( $input['sync'] ) ) {
			$s = $input['sync'];
			if ( isset( $s['enabled'] ) ) {
				$clean['sync']['enabled'] = (bool) $s['enabled'];
			}
			if ( isset( $s['append_to_notes'] ) ) {
				$clean['sync']['append_to_notes'] = (bool) $s['append_to_notes'];
			}
			if ( isset( $s['max_attempts'] ) ) {
				$clean['sync']['max_attempts'] = max( 1, min( 10, absint( $s['max_attempts'] ) ) );
			}
			if ( isset( $s['duplicate_check'] ) ) {
				$clean['sync']['duplicate_check'] = in_array( $s['duplicate_check'], array( 'off', 'skip' ), true ) ? $s['duplicate_check'] : 'off';
			}
			foreach ( array( 'agency_attribute', 'rep_attribute', 'rep_email_attr' ) as $key ) {
				if ( isset( $s[ $key ] ) ) {
					$clean['sync'][ $key ] = self::logical_name( $s[ $key ] );
				}
			}
			if ( isset( $s['subject_template'] ) ) {
				$clean['sync']['subject_template'] = sanitize_text_field( $s['subject_template'] );
			}
		}

		if ( isset( $input['branding'] ) && is_array( $input['branding'] ) ) {
			$b = $input['branding'];
			foreach ( array( 'product_name', 'tagline' ) as $key ) {
				if ( isset( $b[ $key ] ) ) {
					$clean['branding'][ $key ] = sanitize_text_field( $b[ $key ] );
				}
			}
			if ( isset( $b['logo_url'] ) ) {
				$clean['branding']['logo_url'] = esc_url_raw( $b['logo_url'] );
			}
			if ( isset( $b['primary_color'] ) ) {
				$color                              = sanitize_hex_color( $b['primary_color'] );
				$clean['branding']['primary_color'] = $color ? $color : $current['branding']['primary_color'];
			}
			if ( isset( $b['support_email'] ) ) {
				$clean['branding']['support_email'] = sanitize_email( $b['support_email'] );
			}
		}

		if ( isset( $input['security'] ) && is_array( $input['security'] ) ) {
			$s = $input['security'];
			if ( isset( $s['login_attempts'] ) ) {
				$clean['security']['login_attempts'] = max( 1, min( 50, absint( $s['login_attempts'] ) ) );
			}
			if ( isset( $s['lockout_minutes'] ) ) {
				$clean['security']['lockout_minutes'] = max( 1, min( 1440, absint( $s['lockout_minutes'] ) ) );
			}
			if ( isset( $s['match_subdomains'] ) ) {
				$clean['security']['match_subdomains'] = (bool) $s['match_subdomains'];
			}
			if ( isset( $s['max_csv_rows'] ) ) {
				$clean['security']['max_csv_rows'] = max( 1, min( 10000, absint( $s['max_csv_rows'] ) ) );
			}
			if ( isset( $s['max_csv_kb'] ) ) {
				$clean['security']['max_csv_kb'] = max( 16, min( 20480, absint( $s['max_csv_kb'] ) ) );
			}
		}

		if ( isset( $input['emails'] ) && is_array( $input['emails'] ) ) {
			$e = $input['emails'];
			foreach ( array( 'from_name', 'verify_subject', 'invite_subject', 'reset_subject' ) as $key ) {
				if ( isset( $e[ $key ] ) ) {
					$clean['emails'][ $key ] = sanitize_text_field( $e[ $key ] );
				}
			}
			if ( isset( $e['from_email'] ) ) {
				$clean['emails']['from_email'] = sanitize_email( $e['from_email'] );
			}
			foreach ( array( 'verify_body', 'invite_body', 'reset_body' ) as $key ) {
				if ( isset( $e[ $key ] ) ) {
					$clean['emails'][ $key ] = sanitize_textarea_field( $e[ $key ] );
				}
			}
		}

		$connection_changed = $clean['dynamics'] !== $current['dynamics'];
		update_option( self::OPTION, $clean, false );
		if ( $connection_changed ) {
			delete_transient( 'contact_sync_token' );
		}
		return $clean;
	}

	/**
	 * Settings safe to send to the admin UI (secret masked).
	 *
	 * @return array
	 */
	public static function for_admin() {
		$all                              = self::all();
		$all['dynamics']['has_secret']    = '' !== $all['dynamics']['client_secret'];
		$all['dynamics']['client_secret'] = '';
		return $all;
	}

	/**
	 * Keep only characters valid in a Dataverse logical name.
	 *
	 * @param string $value Raw value.
	 * @return string
	 */
	public static function logical_name( $value ) {
		return strtolower( preg_replace( '/[^A-Za-z0-9_@.]/', '', (string) $value ) );
	}

	/**
	 * Recursive merge where stored values override defaults.
	 *
	 * @param array $defaults Defaults.
	 * @param array $stored   Stored values.
	 * @return array
	 */
	private static function merge( array $defaults, array $stored ) {
		foreach ( $defaults as $key => $value ) {
			if ( is_array( $value ) && isset( $stored[ $key ] ) && is_array( $stored[ $key ] ) ) {
				$defaults[ $key ] = self::merge( $value, $stored[ $key ] );
			} elseif ( array_key_exists( $key, $stored ) ) {
				$defaults[ $key ] = $stored[ $key ];
			}
		}
		return $defaults;
	}
}
