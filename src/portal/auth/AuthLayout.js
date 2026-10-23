import { __ } from '@wordpress/i18n';
import Icon from '../../shared/icons';
import { branding } from '../config';

const FEATURES = [
	{
		icon: 'zap',
		title: __( 'Instant hand-off', 'contact-sync' ),
		text: __( 'Leads go straight to the sales team.', 'contact-sync' ),
	},
	{
		icon: 'upload',
		title: __( 'Bulk upload', 'contact-sync' ),
		text: __(
			'Import hundreds of leads from a spreadsheet in minutes.',
			'contact-sync'
		),
	},
	{
		icon: 'checkCircle',
		title: __( 'Full visibility', 'contact-sync' ),
		text: __(
			'Track the status of every lead you submit.',
			'contact-sync'
		),
	},
];

export function Brand( { light } ) {
	return (
		<div className={ `cs-brand ${ light ? 'cs-brand--light' : '' }` }>
			{ branding.logo_url ? (
				<img
					src={ branding.logo_url }
					alt={ branding.product_name }
					className="cs-brand__logo"
				/>
			) : (
				<>
					<span className="cs-brand__mark">
						<Icon name="cloud" size={ 18 } />
					</span>
					<span className="cs-brand__name">
						{ branding.product_name }
					</span>
				</>
			) }
		</div>
	);
}

export default function AuthLayout( { title, subtitle, children, footer } ) {
	return (
		<div className="cs-auth">
			<aside className="cs-auth__aside">
				<div className="cs-auth__aside-inner">
					<Brand light />
					<div className="cs-auth__pitch">
						<h2>
							{ branding.tagline ||
								__(
									'Submit and track your leads in one place.',
									'contact-sync'
								) }
						</h2>
						<ul className="cs-auth__features">
							{ FEATURES.map( ( feature ) => (
								<li key={ feature.title }>
									<span className="cs-auth__feature-icon">
										<Icon
											name={ feature.icon }
											size={ 18 }
										/>
									</span>
									<div>
										<strong>{ feature.title }</strong>
										<span>{ feature.text }</span>
									</div>
								</li>
							) ) }
						</ul>
					</div>
					<p className="cs-auth__legal">
						© { new Date().getFullYear() }{ ' ' }
						{ branding.product_name }
						{ branding.support_email && (
							<>
								{ ' · ' }
								<a
									href={ `mailto:${ branding.support_email }` }
								>
									{ branding.support_email }
								</a>
							</>
						) }
					</p>
				</div>
			</aside>
			<main className="cs-auth__main">
				<div className="cs-auth__mobile-brand">
					<Brand />
				</div>
				<div className="cs-auth__panel">
					<div className="cs-auth__head">
						<h1>{ title }</h1>
						{ subtitle && <p>{ subtitle }</p> }
					</div>
					{ children }
				</div>
				{ footer && <div className="cs-auth__footer">{ footer }</div> }
			</main>
		</div>
	);
}
