<?php
/**
 * Data & logs settings tests.
 *
 * @package ContactSync
 */

use ContactSync\Rest\SettingsController;
use ContactSync\Support\Settings;
use PHPUnit\Framework\TestCase;

class DataSettingsTest extends TestCase {

	protected function tearDown(): void {
		unset( $GLOBALS['cs_options']['contact_sync_settings'] );
	}

	public function test_defaults_keep_hard_delete_and_set_retention() {
		$this->assertFalse( Settings::get( 'data.soft_delete' ) );
		$this->assertSame( 30, Settings::get( 'data.trash_days' ) );
		$this->assertSame( 90, Settings::get( 'data.log_days' ) );
	}

	public function test_retention_days_are_clamped() {
		Settings::update(
			array(
				'data' => array(
					'soft_delete' => '1',
					'trash_days'  => -5,
					'log_days'    => 99999,
				),
			)
		);
		$this->assertTrue( Settings::get( 'data.soft_delete' ) );
		$this->assertSame( 0, Settings::get( 'data.trash_days' ) );
		$this->assertSame( 3650, Settings::get( 'data.log_days' ) );
	}

	public function test_changed_keys_lists_paths_only() {
		$before = array(
			'data'     => array( 'soft_delete' => false, 'log_days' => 90 ),
			'dynamics' => array( 'client_secret' => 'old' ),
		);
		$after  = array(
			'data'     => array( 'soft_delete' => true, 'log_days' => 90 ),
			'dynamics' => array( 'client_secret' => 'new' ),
		);
		$this->assertSame( array( 'data.soft_delete', 'dynamics.client_secret' ), SettingsController::changed_keys( $before, $after ) );
	}
}
