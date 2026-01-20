/**
 * pnpm Resolution Hooks
 * 
 * This file allows us to override transitive dependency versions
 * to fix security vulnerabilities across all workspaces.
 * 
 * @see https://pnpm.io/pnpmfile
 */

function readPackage(pkg, context) {
    // Fix @babel/runtime vulnerability (CVE in < 7.26.10)
    if (pkg.dependencies && pkg.dependencies['@babel/runtime']) {
        const version = pkg.dependencies['@babel/runtime'];
        // Only override if it's an older version
        if (!version.includes('^7.26') && !version.includes('>=7.26')) {
            pkg.dependencies['@babel/runtime'] = '^7.26.10';
            context.log(`Overriding @babel/runtime in ${pkg.name}`);
        }
    }

    // Fix diff vulnerability (CVE in < 8.0.3)
    if (pkg.dependencies && pkg.dependencies['diff']) {
        pkg.dependencies['diff'] = '^8.0.3';
        context.log(`Overriding diff in ${pkg.name}`);
    }

    // Fix undici vulnerability (CVE in < 6.23.0)
    if (pkg.dependencies && pkg.dependencies['undici']) {
        const version = pkg.dependencies['undici'];
        if (!version.includes('^6.23') && !version.includes('>=6.23')) {
            pkg.dependencies['undici'] = '^6.23.0';
            context.log(`Overriding undici in ${pkg.name}`);
        }
    }

    // Fix tar vulnerability (CVE in <= 7.5.2)
    if (pkg.dependencies && pkg.dependencies['tar']) {
        pkg.dependencies['tar'] = '^7.5.3';
        context.log(`Overriding tar in ${pkg.name}`);
    }

    // Fix preact vulnerability (CVE in >= 10.28.0 < 10.28.2)
    if (pkg.dependencies && pkg.dependencies['preact']) {
        pkg.dependencies['preact'] = '^10.28.2';
        context.log(`Overriding preact in ${pkg.name}`);
    }

    return pkg;
}

module.exports = {
    hooks: {
        readPackage,
    },
};
