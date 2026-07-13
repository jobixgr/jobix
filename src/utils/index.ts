

export function createPageUrl(pageName: string, id?: string) {
    const base = '/' + pageName.toLowerCase().replace(/ /g, '-');
    return id ? `${base}/${id}` : base;
}
