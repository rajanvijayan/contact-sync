<?php
/**
 * Agency manager access-control rules.
 *
 * @package ContactSync
 */

use ContactSync\Reps\RepService;
use PHPUnit\Framework\TestCase;

class ManagerTeamTest extends TestCase {

	private function rep( array $overrides = array() ) {
		return array_merge(
			array(
				'id'          => 20,
				'role'        => 'cs_rep',
				'status'      => 'active',
				'is_admin'    => false,
				'agency'      => array( 'id' => 5, 'name' => 'Acme' ),
				'disabled_by' => null,
			),
			$overrides
		);
	}

	private function code( $result ) {
		return is_wp_error( $result ) ? $result->get_error_code() : $result;
	}

	public function test_manager_can_disable_and_re_enable_own_rep() {
		$this->assertTrue( RepService::manager_can_set_status( $this->rep(), 10, 5, 'disabled' ) );
		$this->assertTrue( RepService::manager_can_set_status( $this->rep( array( 'status' => 'disabled', 'disabled_by' => 'manager' ) ), 10, 5, 'active' ) );
	}

	public function test_other_agencies_and_admins_are_hidden() {
		$this->assertSame( 'cs_not_found', $this->code( RepService::manager_can_set_status( $this->rep( array( 'agency' => array( 'id' => 6 ) ) ), 10, 5, 'disabled' ) ) );
		$this->assertSame( 'cs_not_found', $this->code( RepService::manager_can_set_status( $this->rep( array( 'agency' => null ) ), 10, 5, 'disabled' ) ) );
		$this->assertSame( 'cs_not_found', $this->code( RepService::manager_can_set_status( $this->rep( array( 'is_admin' => true ) ), 10, 5, 'disabled' ) ) );
	}

	public function test_blocked_changes() {
		$this->assertSame( 'cs_forbidden', $this->code( RepService::manager_can_set_status( $this->rep( array( 'id' => 10 ) ), 10, 5, 'disabled' ) ), 'self' );
		$this->assertSame( 'cs_forbidden', $this->code( RepService::manager_can_set_status( $this->rep( array( 'role' => 'cs_agency_manager' ) ), 10, 5, 'disabled' ) ), 'other manager' );
		$this->assertSame( 'cs_forbidden', $this->code( RepService::manager_can_set_status( $this->rep( array( 'status' => 'pending' ) ), 10, 5, 'active' ) ), 'unverified' );
		$this->assertSame( 'cs_forbidden', $this->code( RepService::manager_can_set_status( $this->rep( array( 'status' => 'disabled' ) ), 10, 5, 'active' ) ), 'disabled by admin' );
		$this->assertSame( 'cs_invalid', $this->code( RepService::manager_can_set_status( $this->rep(), 10, 5, 'pending' ) ), 'bad status' );
	}
}
