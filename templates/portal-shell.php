<?php
/**
 * Bare HTML shell for the rep portal. No theme output is loaded.
 *
 * @package ContactSync
 */

defined( 'ABSPATH' ) || exit;

$contact_sync_branding = \ContactSync\Portal\Assets::branding();
$contact_sync_titles   = array(
	'login'           => __( 'Sign in', 'contact-sync' ),
	'signup'          => __( 'Create account', 'contact-sync' ),
	'verify'          => __( 'Verify email', 'contact-sync' ),
	'forgot-password' => __( 'Forgot password', 'contact-sync' ),
	'reset-password'  => __( 'Set password', 'contact-sync' ),
	'app'             => __( 'Dashboard', 'contact-sync' ),
);
$contact_sync_route    = \ContactSync\Portal\Router::current();
?><!doctype html>
<html <?php language_attributes(); ?>>
<head>
	<meta charset="<?php bloginfo( 'charset' ); ?>">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<meta name="robots" content="noindex, nofollow">
	<title><?php echo esc_html( ( $contact_sync_titles[ $contact_sync_route ] ?? '' ) . ' · ' . $contact_sync_branding['product_name'] ); ?></title>
	<?php if ( has_site_icon() ) : ?>
		<link rel="icon" href="<?php echo esc_url( get_site_icon_url( 64 ) ); ?>">
	<?php endif; ?>
	<link rel="preconnect" href="https://fonts.googleapis.com">
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
	<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"><?php // phpcs:ignore WordPress.WP.EnqueuedResources.NonEnqueuedStylesheet ?>
	<style>:root{--cs-brand:<?php echo esc_html( $contact_sync_branding['primary_color'] ); ?>}</style>
	<?php wp_print_styles( array( 'contact-sync-portal' ) ); ?>
</head>
<body class="cs-portal">
	<div id="contact-sync-portal" class="cs-root">
		<div class="cs-boot"><span class="cs-boot__spinner"></span></div>
	</div>
	<noscript><?php esc_html_e( 'Please enable JavaScript to use this application.', 'contact-sync' ); ?></noscript>
	<?php wp_print_scripts( array( 'contact-sync-portal' ) ); ?>
</body>
</html>
