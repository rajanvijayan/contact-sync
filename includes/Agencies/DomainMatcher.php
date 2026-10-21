<?php
/**
 * Email domain helpers.
 *
 * @package ContactSync
 */

namespace ContactSync\Agencies;

defined( 'ABSPATH' ) || exit;

/**
 * Normalises domains and matches email addresses against agency domains.
 */
class DomainMatcher {

	/**
	 * Normalise a user-entered domain ("https://www.Acme.com/" -> "acme.com").
	 *
	 * @param string $domain Raw domain or URL.
	 * @return string Empty string when invalid.
	 */
	public static function normalize( $domain ) {
		$domain = strtolower( trim( (string) $domain ) );
		$domain = preg_replace( '#^[a-z]+://#', '', $domain );
		$domain = preg_replace( '#[/?\#].*$#', '', $domain );
		$domain = ltrim( $domain, '@' );
		$domain = preg_replace( '/^www\./', '', $domain );
		$domain = rtrim( $domain, '.' );

		if ( ! preg_match( '/^(?=.{3,190}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/', $domain ) ) {
			return '';
		}
		return $domain;
	}

	/**
	 * Extract the domain part of an email address.
	 *
	 * @param string $email Email address.
	 * @return string
	 */
	public static function from_email( $email ) {
		$email = strtolower( trim( (string) $email ) );
		$at    = strrpos( $email, '@' );
		if ( false === $at ) {
			return '';
		}
		return self::normalize( substr( $email, $at + 1 ) );
	}

	/**
	 * Candidate domains to look up for an email domain.
	 *
	 * With subdomain matching, "sales.eu.acme.com" yields itself, "eu.acme.com" and "acme.com"
	 * (most specific first) so the closest registered domain wins.
	 *
	 * @param string $domain           Normalised domain.
	 * @param bool   $match_subdomains Whether parent domains are allowed.
	 * @return string[]
	 */
	public static function candidates( $domain, $match_subdomains ) {
		if ( '' === $domain ) {
			return array();
		}
		if ( ! $match_subdomains ) {
			return array( $domain );
		}
		$parts = explode( '.', $domain );
		$list  = array();
		for ( $i = 0, $n = count( $parts ); $i <= $n - 2; $i++ ) {
			$list[] = implode( '.', array_slice( $parts, $i ) );
		}
		return $list;
	}
}
