<?php
/**
 * Domain helper tests.
 *
 * @package ContactSync
 */

use ContactSync\Agencies\DomainMatcher;
use PHPUnit\Framework\TestCase;

class DomainMatcherTest extends TestCase {

	public function test_normalize_strips_scheme_www_and_path() {
		$this->assertSame( 'acme.com', DomainMatcher::normalize( 'https://www.Acme.com/about?x=1' ) );
		$this->assertSame( 'acme.co.uk', DomainMatcher::normalize( '@acme.co.uk' ) );
		$this->assertSame( 'sales.acme.com', DomainMatcher::normalize( 'sales.acme.com.' ) );
	}

	public function test_normalize_rejects_invalid() {
		$this->assertSame( '', DomainMatcher::normalize( 'localhost' ) );
		$this->assertSame( '', DomainMatcher::normalize( 'not a domain' ) );
		$this->assertSame( '', DomainMatcher::normalize( '-bad.com' ) );
	}

	public function test_from_email() {
		$this->assertSame( 'acme.com', DomainMatcher::from_email( 'Jane.Doe@ACME.com' ) );
		$this->assertSame( '', DomainMatcher::from_email( 'no-at-sign' ) );
	}

	public function test_candidates() {
		$this->assertSame( array( 'eu.acme.com' ), DomainMatcher::candidates( 'eu.acme.com', false ) );
		$this->assertSame( array( 'sales.eu.acme.com', 'eu.acme.com', 'acme.com' ), DomainMatcher::candidates( 'sales.eu.acme.com', true ) );
		$this->assertSame( array(), DomainMatcher::candidates( '', true ) );
	}
}
