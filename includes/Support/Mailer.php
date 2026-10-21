<?php
/**
 * Transactional email.
 *
 * @package ContactSync
 */

namespace ContactSync\Support;

defined( 'ABSPATH' ) || exit;

/**
 * Sends branded HTML emails built from the templates in Settings.
 */
class Mailer {

	/**
	 * Call-to-action labels per template.
	 *
	 * @return array
	 */
	private static function cta_labels() {
		return array(
			'verify' => __( 'Confirm email address', 'contact-sync' ),
			'invite' => __( 'Set your password', 'contact-sync' ),
			'reset'  => __( 'Reset password', 'contact-sync' ),
		);
	}

	/**
	 * Send a templated email.
	 *
	 * @param string $to       Recipient.
	 * @param string $template verify|invite|reset.
	 * @param array  $vars     Placeholder values (first_name, link, ...).
	 * @return bool
	 */
	public static function send( $to, $template, array $vars ) {
		$emails   = Settings::get( 'emails', array() );
		$branding = Settings::get( 'branding', array() );

		$vars = array_merge(
			array(
				'site'       => $branding['product_name'] ? $branding['product_name'] : get_bloginfo( 'name' ),
				'first_name' => '',
				'link'       => '',
			),
			$vars
		);

		$subject = self::replace( $emails[ $template . '_subject' ] ?? '', $vars );
		$body    = self::replace( $emails[ $template . '_body' ] ?? '', $vars );
		$labels  = self::cta_labels();
		$html    = self::layout( $body, $labels[ $template ] ?? '', $vars['link'], $branding, $vars['site'] );

		$headers = array( 'Content-Type: text/html; charset=UTF-8' );
		if ( ! empty( $emails['from_email'] ) ) {
			$from_name = $emails['from_name'] ? $emails['from_name'] : $vars['site'];
			$headers[] = sprintf( 'From: %s <%s>', wp_specialchars_decode( $from_name ), $emails['from_email'] );
		}

		return wp_mail( $to, wp_specialchars_decode( $subject ), $html, $headers );
	}

	/**
	 * Replace {placeholders}.
	 *
	 * @param string $text Template.
	 * @param array  $vars Values.
	 * @return string
	 */
	public static function replace( $text, array $vars ) {
		$search  = array();
		$replace = array();
		foreach ( $vars as $key => $value ) {
			if ( is_scalar( $value ) ) {
				$search[]  = '{' . $key . '}';
				$replace[] = (string) $value;
			}
		}
		return str_replace( $search, $replace, (string) $text );
	}

	/**
	 * Wrap body text in the email layout.
	 *
	 * @param string $body     Plain text body.
	 * @param string $cta      Button label.
	 * @param string $link     Button URL.
	 * @param array  $branding Branding settings.
	 * @param string $site     Product name.
	 * @return string
	 */
	private static function layout( $body, $cta, $link, array $branding, $site ) {
		$color = $branding['primary_color'] ? $branding['primary_color'] : '#2563eb';
		$logo  = $branding['logo_url'] ? '<img src="' . esc_url( $branding['logo_url'] ) . '" alt="' . esc_attr( $site ) . '" style="max-height:40px;max-width:200px">' : '<strong style="font-size:18px;color:#0f172a">' . esc_html( $site ) . '</strong>';

		$paragraphs = '';
		foreach ( preg_split( "/\n\s*\n/", trim( $body ) ) as $p ) {
			$paragraphs .= '<p style="margin:0 0 16px;line-height:1.6">' . nl2br( esc_html( $p ) ) . '</p>';
		}

		$button = '';
		if ( $link && $cta ) {
			$button = '<p style="margin:24px 0"><a href="' . esc_url( $link ) . '" style="display:inline-block;background:' . esc_attr( $color ) . ';color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600">' . esc_html( $cta ) . '</a></p>'
				. '<p style="margin:0 0 16px;font-size:12px;color:#64748b;line-height:1.5">' . esc_html__( 'If the button does not work, copy this link into your browser:', 'contact-sync' ) . '<br><a href="' . esc_url( $link ) . '" style="color:#64748b;word-break:break-all">' . esc_html( $link ) . '</a></p>';
		}

		$footer = $branding['support_email']
			/* translators: %s: support email */
			? sprintf( esc_html__( 'Questions? Contact %s', 'contact-sync' ), '<a href="mailto:' . esc_attr( $branding['support_email'] ) . '" style="color:#64748b">' . esc_html( $branding['support_email'] ) . '</a>' )
			: esc_html( $site );

		return '<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a">'
			. '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px"><tr><td align="center">'
			. '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;border:1px solid #e2e8f0">'
			. '<tr><td style="padding:24px 32px;border-bottom:1px solid #e2e8f0">' . $logo . '</td></tr>'
			. '<tr><td style="padding:32px;font-size:15px">' . $paragraphs . $button . '</td></tr>'
			. '</table>'
			. '<p style="font-size:12px;color:#64748b;margin:16px 0 0">' . $footer . '</p>'
			. '</td></tr></table></body></html>';
	}
}
