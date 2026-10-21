<?php
/**
 * Reports endpoints.
 *
 * @package ContactSync
 */

namespace ContactSync\Rest;

use ContactSync\Reports\ReportService;
use WP_REST_Request;
use WP_REST_Server;

defined( 'ABSPATH' ) || exit;

/**
 * Lead volume by agency and period, plus CSV exports.
 */
class ReportsController extends Controller {

	const EXPORTS = array( 'agencies', 'periods', 'matrix' );

	/**
	 * Register routes.
	 */
	public function routes() {
		$args = array(
			'from'   => array( 'type' => 'string' ),
			'to'     => array( 'type' => 'string' ),
			'group'  => array(
				'type' => 'string',
				'enum' => array_merge( array( '' ), ReportService::GROUPS ),
			),
			'agency' => array( 'type' => 'string' ),
		);
		$this->route(
			'/reports',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( $this, 'show' ),
				'permission_callback' => array( $this, 'can_manage' ),
				'args'                => $args,
			)
		);
		$this->route(
			'/reports/export',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( $this, 'export' ),
				'permission_callback' => array( $this, 'can_manage' ),
				'args'                => array_merge(
					$args,
					array(
						'type' => array(
							'type'    => 'string',
							'enum'    => self::EXPORTS,
							'default' => 'agencies',
						),
					)
				),
			)
		);
	}

	/**
	 * Build the report for a request.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return array
	 */
	private function build( WP_REST_Request $request ) {
		$service = new ReportService();
		return $service->report(
			$service->args(
				(string) $request['from'],
				(string) $request['to'],
				(string) $request['group'],
				(string) $request['agency']
			)
		);
	}

	/**
	 * GET /reports
	 *
	 * @param WP_REST_Request $request Request.
	 * @return mixed
	 */
	public function show( WP_REST_Request $request ) {
		return $this->respond( $this->build( $request ) );
	}

	/**
	 * GET /reports/export — agencies, periods or an agency × period matrix as CSV.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return mixed
	 */
	public function export( WP_REST_Request $request ) {
		$report = $this->build( $request );
		$range  = $report['range'];
		$type   = in_array( $request['type'], self::EXPORTS, true ) ? $request['type'] : 'agencies';

		if ( 'periods' === $type ) {
			$headers = array( 'Period start', 'Period end', 'Leads', 'Delivered', 'Duplicates', 'Pending', 'Failed' );
			$rows    = array();
			foreach ( $report['series'] as $point ) {
				$rows[] = array( $point['start'], $point['end'], $point['total'], $point['delivered'], $point['duplicate'], $point['pending'], $point['failed'] );
			}
			$t      = $report['totals'];
			$rows[] = array( 'Total', '', $t['total'], $t['delivered'], $t['duplicate'], $t['pending'], $t['failed'] );
			$name   = 'leads-by-' . $range['group'];
		} elseif ( 'matrix' === $type ) {
			$headers = array_merge(
				array( 'Agency' ),
				wp_list_pluck( $report['series'], 'start' ),
				array( 'Total' )
			);
			$rows    = array();
			foreach ( $report['agencies'] as $agency ) {
				$rows[] = array_merge( array( $agency['name'] ), $agency['series'], array( $agency['total'] ) );
			}
			$rows[] = array_merge( array( 'Total' ), wp_list_pluck( $report['series'], 'total' ), array( $report['totals']['total'] ) );
			$name   = 'leads-agency-by-' . $range['group'];
		} else {
			$headers = array( 'Agency', 'Leads', 'Share %', 'Delivered', 'Duplicates', 'Pending', 'Failed', 'Active reps', 'Previous period', 'Change %' );
			$rows    = array();
			foreach ( $report['agencies'] as $agency ) {
				$rows[] = array(
					$agency['name'],
					$agency['total'],
					$agency['share'],
					$agency['delivered'],
					$agency['duplicate'],
					$agency['pending'],
					$agency['failed'],
					$agency['reps'],
					$agency['previous'],
					self::change( $agency['total'], $agency['previous'] ),
				);
			}
			$t      = $report['totals'];
			$rows[] = array( 'Total', $t['total'], $t['total'] ? 100 : 0, $t['delivered'], $t['duplicate'], $t['pending'], $t['failed'], $t['reps'], $report['previous']['total'], self::change( $t['total'], $report['previous']['total'] ) );
			$name   = 'leads-by-agency';
		}

		return $this->respond(
			array(
				'filename' => sprintf( '%s_%s_%s.csv', $name, $range['from'], $range['to'] ),
				'content'  => self::to_csv( $headers, $rows ),
				'count'    => count( $rows ),
			)
		);
	}

	/**
	 * Percentage change, blank when there is no baseline.
	 *
	 * @param int $current  Current.
	 * @param int $previous Previous.
	 * @return float|string
	 */
	private static function change( $current, $previous ) {
		return $previous ? round( ( $current - $previous ) / $previous * 100, 1 ) : '';
	}
}
