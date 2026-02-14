/**
 * Wiki documentation structure.
 * Maps slugs to document paths and titles.
 */
export interface DocItem {
    slug: string;
    title: string;
    path: string;
    children?: DocItem[];
}

export const wikiDocs: DocItem[] = [
    {
        slug: 'getting-started',
        title: 'Getting Started',
        path: '/docs/product/getting-started.md',
    },
    {
        slug: 'quick-start',
        title: 'Quick Start',
        path: '/docs/product/quick-start.md',
    },
    {
        slug: 'user-manual',
        title: 'User Manual',
        path: '/docs/product/README.md',
        children: [
            {
                slug: 'user-manual/creating-requests',
                title: 'Creating Requests',
                path: '/docs/product/user-manual/creating-requests.md',
            },
            {
                slug: 'user-manual/submitting-steps',
                title: 'Submitting Steps',
                path: '/docs/product/user-manual/submitting-steps.md',
            },
            {
                slug: 'user-manual/approving-requests',
                title: 'Approving Requests',
                path: '/docs/product/user-manual/approving-requests.md',
            },
            {
                slug: 'user-manual/managing-teams',
                title: 'Managing Teams',
                path: '/docs/product/user-manual/managing-teams.md',
            },
        ],
    },
    {
        slug: 'security',
        title: 'Security & Access',
        path: '/docs/product/security/understanding-roles.md',
        children: [
            {
                slug: 'security/understanding-roles',
                title: 'Understanding Roles',
                path: '/docs/product/security/understanding-roles.md',
            },
            {
                slug: 'security/visibility-rules',
                title: 'Visibility Rules',
                path: '/docs/product/security/visibility-rules.md',
            },
        ],
    },
    {
        slug: 'admin-guide',
        title: 'Administrator Guide',
        path: '/docs/product/admin-guide/role-management.md',
        children: [
            {
                slug: 'admin-guide/role-management',
                title: 'Role Management',
                path: '/docs/product/admin-guide/role-management.md',
            },
            {
                slug: 'admin-guide/group-management',
                title: 'Group Management',
                path: '/docs/product/admin-guide/group-management.md',
            },
        ],
    },
    {
        slug: 'faq',
        title: 'FAQ',
        path: '/docs/product/faq.md',
    },
];

/**
 * Find a doc item by slug (searches nested children too)
 */
export function findDocBySlug(slug: string): DocItem | undefined {
    for (const doc of wikiDocs) {
        if (doc.slug === slug) return doc;
        if (doc.children) {
            const child = doc.children.find(c => c.slug === slug);
            if (child) return child;
        }
    }
    return undefined;
}
