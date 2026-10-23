import { useCallback, useEffect, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { get, post } from '../../shared/api';
import Icon from '../../shared/icons';
import { ROLES, setCrmConnected } from '../../shared/format';
import { Alert, Avatar, Badge, Menu, Spinner, cx } from '../../shared/ui';
import { Brand } from '../auth/AuthLayout';
import config, { urls } from '../config';
import { Link, usePath } from '../router';
import { PortalContext } from './context';
import Dashboard from './Dashboard';
import NewLead from './NewLead';
import BulkUpload from './BulkUpload';
import Submissions from './Submissions';
import Templates from './Templates';
import Team from './Team';

export default function AppShell() {
	const path = usePath();
	const [ me, setMe ] = useState( null );
	const [ error, setError ] = useState( null );
	const [ navOpen, setNavOpen ] = useState( false );

	const reload = useCallback(
		() =>
			get( '/portal/me' )
				.then( ( data ) => {
					setCrmConnected( data.delivery_active );
					setMe( data );
				} )
				.catch( setError ),
		[]
	);

	useEffect( () => {
		reload();
	}, [ reload ] );

	useEffect( () => setNavOpen( false ), [ path ] );

	const titles = {
		'app/new': __( 'New lead', 'contact-sync' ),
		'app/bulk': __( 'Bulk upload', 'contact-sync' ),
		'app/submissions': __( 'My submissions', 'contact-sync' ),
		'app/agency': __( 'Agency leads', 'contact-sync' ),
		'app/team': __( 'Team', 'contact-sync' ),
		'app/template': __( 'CSV template', 'contact-sync' ),
	};
	useEffect( () => {
		document.title = `${
			titles[ path ] || __( 'Dashboard', 'contact-sync' )
		} · ${ config.branding?.product_name || '' }`;
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ path ] );

	const user = me?.user || config.user;
	const nav = [
		{
			to: 'app',
			icon: 'dashboard',
			label: __( 'Dashboard', 'contact-sync' ),
		},
		{
			to: 'app/new',
			icon: 'plus',
			label: __( 'New lead', 'contact-sync' ),
		},
		{
			to: 'app/bulk',
			icon: 'upload',
			label: __( 'Bulk upload', 'contact-sync' ),
		},
		{
			to: 'app/submissions',
			icon: 'list',
			label: __( 'My submissions', 'contact-sync' ),
		},
		user?.can_view_agency && {
			to: 'app/agency',
			icon: 'building',
			label: __( 'Agency leads', 'contact-sync' ),
		},
		user?.can_manage_team && {
			to: 'app/team',
			icon: 'users',
			label: __( 'Team', 'contact-sync' ),
		},
		{
			to: 'app/template',
			icon: 'file',
			label: __( 'CSV template', 'contact-sync' ),
		},
	].filter( Boolean );

	const logout = async () => {
		try {
			const result = await post( '/auth/logout' );
			window.location.assign( result.redirect );
		} catch ( e ) {
			window.location.assign( urls.login );
		}
	};

	let page;
	switch ( path ) {
		case 'app/new':
			page = <NewLead />;
			break;
		case 'app/bulk':
			page = <BulkUpload />;
			break;
		case 'app/submissions':
			page = <Submissions scope="mine" />;
			break;
		case 'app/agency':
			page = <Submissions scope="agency" />;
			break;
		case 'app/team':
			page = user?.can_manage_team ? <Team /> : <Dashboard />;
			break;
		case 'app/template':
			page = <Templates />;
			break;
		default:
			page = <Dashboard />;
	}

	return (
		<PortalContext.Provider value={ { me, reload } }>
			<div className={ cx( 'cs-app', navOpen && 'is-nav-open' ) }>
				<aside className="cs-sidebar">
					<div className="cs-sidebar__brand">
						<Brand />
					</div>
					<nav
						className="cs-sidebar__nav"
						aria-label={ __( 'Main', 'contact-sync' ) }
					>
						{ nav.map( ( item ) => (
							<Link
								key={ item.to }
								to={ item.to }
								className={ cx(
									'cs-nav-item',
									( path === item.to ||
										( item.to === 'app' &&
											path === '' ) ) &&
										'is-active'
								) }
								aria-current={
									path === item.to ? 'page' : undefined
								}
							>
								<Icon name={ item.icon } size={ 18 } />
								{ item.label }
							</Link>
						) ) }
					</nav>
					{ urls.admin && (
						<a
							className="cs-nav-item cs-nav-item--admin"
							href={ urls.admin }
						>
							<Icon name="settings" size={ 18 } />
							{ __( 'Admin console', 'contact-sync' ) }
							<Icon
								name="external"
								size={ 14 }
								className="cs-nav-item__ext"
							/>
						</a>
					) }
					<div className="cs-sidebar__footer">
						<Menu
							align="left"
							trigger={ ( { toggle } ) => (
								<button
									type="button"
									className="cs-usercard"
									onClick={ toggle }
								>
									<Avatar name={ user?.name } size={ 36 } />
									<span className="cs-usercard__text">
										<strong>{ user?.name }</strong>
										<span>{ user?.email }</span>
									</span>
									<Icon name="chevronDown" size={ 16 } />
								</button>
							) }
							items={ [
								{
									label: __( 'Sign out', 'contact-sync' ),
									icon: 'logout',
									onClick: logout,
								},
							] }
						/>
					</div>
				</aside>
				<button
					type="button"
					className="cs-sidebar__scrim"
					aria-label={ __( 'Close menu', 'contact-sync' ) }
					onClick={ () => setNavOpen( false ) }
				/>
				<div className="cs-main">
					<header className="cs-topbar">
						<button
							type="button"
							className="cs-topbar__menu"
							onClick={ () => setNavOpen( true ) }
							aria-label={ __( 'Open menu', 'contact-sync' ) }
						>
							<Icon name="menu" size={ 20 } />
						</button>
						<div className="cs-topbar__agency">
							<Icon
								name={ user?.agency ? 'building' : 'user' }
								size={ 16 }
							/>
							<span>
								{ user?.agency
									? user.agency.name
									: __( 'Independent rep', 'contact-sync' ) }
							</span>
							{ user?.role && user.role !== 'cs_rep' && (
								<Badge tone="brand">
									{ ROLES[ user.role ] }
								</Badge>
							) }
						</div>
						<div className="cs-topbar__actions">
							<Link
								to="app/new"
								className="cs-btn cs-btn--primary cs-btn--sm"
							>
								<Icon name="plus" size={ 16 } />
								<span>
									{ __( 'New lead', 'contact-sync' ) }
								</span>
							</Link>
						</div>
					</header>
					<main className="cs-content">
						{ error && (
							<Alert tone="danger">{ error.message }</Alert>
						) }
						{ ! me && ! error ? (
							<div className="cs-boot">
								<Spinner size={ 28 } />
							</div>
						) : (
							me && page
						) }
					</main>
				</div>
			</div>
		</PortalContext.Provider>
	);
}
