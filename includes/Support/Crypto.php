<?php
/**
 * Symmetric encryption for secrets stored in the options table.
 *
 * @package ContactSync
 */

namespace ContactSync\Support;

defined( 'ABSPATH' ) || exit;

/**
 * Encrypts values with AES-256-GCM using a key derived from the site salts.
 */
class Crypto {

	const PREFIX = 'csenc:';
	const CIPHER = 'aes-256-gcm';

	/**
	 * Derive the encryption key.
	 *
	 * @return string Raw 32 byte key.
	 */
	private static function key() {
		$material = ( defined( 'AUTH_KEY' ) ? AUTH_KEY : '' ) . ( defined( 'SECURE_AUTH_SALT' ) ? SECURE_AUTH_SALT : '' );
		if ( '' === $material ) {
			$material = wp_salt( 'auth' );
		}
		return hash( 'sha256', 'contact-sync|' . $material, true );
	}

	/**
	 * Encrypt a plain text value.
	 *
	 * @param string $plain Plain text.
	 * @return string Encoded cipher text, or the input when encryption is unavailable.
	 */
	public static function encrypt( $plain ) {
		$plain = (string) $plain;
		if ( '' === $plain || ! function_exists( 'openssl_encrypt' ) ) {
			return $plain;
		}
		$iv     = random_bytes( 12 );
		$tag    = '';
		$cipher = openssl_encrypt( $plain, self::CIPHER, self::key(), OPENSSL_RAW_DATA, $iv, $tag );
		if ( false === $cipher ) {
			return $plain;
		}
		return self::PREFIX . base64_encode( $iv . $tag . $cipher ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode
	}

	/**
	 * Decrypt a value produced by encrypt().
	 *
	 * @param string $encoded Encoded value.
	 * @return string Plain text, or an empty string when it cannot be decrypted.
	 */
	public static function decrypt( $encoded ) {
		$encoded = (string) $encoded;
		if ( 0 !== strpos( $encoded, self::PREFIX ) ) {
			return $encoded;
		}
		$raw = base64_decode( substr( $encoded, strlen( self::PREFIX ) ), true ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_decode
		if ( false === $raw || strlen( $raw ) < 29 ) {
			return '';
		}
		$plain = openssl_decrypt( substr( $raw, 28 ), self::CIPHER, self::key(), OPENSSL_RAW_DATA, substr( $raw, 0, 12 ), substr( $raw, 12, 16 ) );
		return false === $plain ? '' : $plain;
	}
}
