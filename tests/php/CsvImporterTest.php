<?php
/**
 * Bulk import preview tests.
 *
 * @package ContactSync
 */

use ContactSync\Forms\FormSchema;
use ContactSync\Import\BatchRepository;
use ContactSync\Import\CsvImporter;
use ContactSync\Submissions\SubmissionRepository;
use ContactSync\Submissions\SubmissionService;
use PHPUnit\Framework\TestCase;

class CsvImporterTest extends TestCase {

	protected function tearDown(): void {
		unset( $GLOBALS['cs_options']['contact_sync_settings'] );
	}

	private function form() {
		return array(
			'id'      => 1,
			'version' => 1,
			'schema'  => FormSchema::sanitize(
				array(
					'fields' => array(
						array( 'type' => 'text', 'key' => 'name', 'label' => 'Name', 'required' => true ),
						array( 'type' => 'email', 'key' => 'email', 'label' => 'Email', 'required' => true ),
					),
				)
			),
		);
	}

	private function importer( array $existing ) {
		$repo = $this->createMock( SubmissionRepository::class );
		$repo->method( 'find_by_emails' )->willReturn( $existing );
		return new CsvImporter( $this->createMock( BatchRepository::class ), $this->createMock( SubmissionService::class ), $repo );
	}

	public function test_flags_existing_and_in_file_duplicates() {
		$report = $this->importer( array( 'old@example.com' => 7 ) )->validate(
			$this->form(),
			array(
				array( 'name' => 'A', 'email' => 'new@example.com' ),
				array( 'name' => 'B', 'email' => 'OLD@example.com ' ),
				array( 'name' => 'C', 'email' => 'New@Example.com' ),
				array( 'name' => '', 'email' => 'other@example.com' ),
				array( 'name' => 'E', 'email' => 'other@example.com' ),
			)
		);

		$this->assertSame( array( null, 'existing', 'file', null, null ), array_column( $report, 'duplicate' ) );
	}

	public function test_no_flags_when_holding_is_off() {
		$GLOBALS['cs_options']['contact_sync_settings'] = array( 'sync' => array( 'hold_duplicates' => false ) );

		$report = $this->importer( array( 'old@example.com' => 7 ) )->validate(
			$this->form(),
			array(
				array( 'name' => 'A', 'email' => 'old@example.com' ),
				array( 'name' => 'B', 'email' => 'old@example.com' ),
			)
		);

		$this->assertSame( array( null, null ), array_column( $report, 'duplicate' ) );
	}

	public function test_normalize_email() {
		$this->assertSame( 'a@b.co', SubmissionRepository::normalize_email( '  A@B.co ' ) );
		$this->assertNull( SubmissionRepository::normalize_email( '' ) );
	}
}
