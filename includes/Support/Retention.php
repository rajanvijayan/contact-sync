<?php
/**
 * Daily clean-up of the trash and old logs.
 *
 * @package ContactSync
 */

namespace ContactSync\Support;

use ContactSync\Submissions\SubmissionRepository;

defined( 'ABSPATH' ) || exit;

/**
 * Empties trashed submissions and prunes the activity and sync logs after the
 * periods set under Settings › Data & logs.
 */
class Retention {

	const HOOK  = 'contact_sync_daily_cleanup';
	const GROUP = 'contact-sync';

	/**
	 * Register the hook and make sure the daily job is scheduled.
	 */
	public static function register() {
		add_action(
			self::HOOK,
			function () {
				( new self() )->run();
			}
		);
		add_action( 'init', array( __CLASS__, 'schedule' ) );
	}

	/**
	 * Schedule the daily run once.
	 */
	public static function schedule() {
		if ( function_exists( 'as_has_scheduled_action' ) ) {
			if ( ! as_has_scheduled_action( self::HOOK, array(), self::GROUP ) ) {
				as_schedule_recurring_action( time() + HOUR_IN_SECONDS, DAY_IN_SECONDS, self::HOOK, array(), self::GROUP );
			}
			return;
		}
		if ( ! wp_next_scheduled( self::HOOK ) ) {
			wp_schedule_event( time() + HOUR_IN_SECONDS, 'daily', self::HOOK );
		}
	}

	/**
	 * Apply the retention settings.
	 *
	 * @return array{trash: int, activity: int, sync: int} Rows removed.
	 */
	public function run() {
		$repo   = new SubmissionRepository();
		$result = array(
			'trash'    => 0,
			'activity' => 0,
			'sync'     => 0,
		);

		$trash_days = (int) Settings::get( 'data.trash_days', 30 );
		if ( $trash_days > 0 ) {
			$result['trash'] = $repo->purge_trash( $trash_days );
		}

		$log_days = (int) Settings::get( 'data.log_days', 90 );
		if ( $log_days > 0 ) {
			$result['activity'] = ActivityLog::purge( $log_days );
			$result['sync']     = $repo->purge_logs( $log_days );
		}

		if ( array_sum( $result ) ) {
			ActivityLog::record(
				'retention_cleanup',
				'system',
				null,
				/* translators: 1: trashed leads, 2: activity entries, 3: sync log entries */
				sprintf( __( 'Automatic clean-up removed %1$d trashed leads, %2$d activity entries and %3$d sync log entries.', 'contact-sync' ), $result['trash'], $result['activity'], $result['sync'] ),
				$result
			);
		}
		return $result;
	}
}
