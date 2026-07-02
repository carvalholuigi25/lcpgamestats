async function fetchTranslations(lang = "en") {
    try {
        const res = await fetch(`/json/langs/${lang}.json`);
        if (!res.ok) throw new Error(`Failed to load translations for ${lang}`);
        const data = await res.json();
        return data[lang] || data || {};
    } catch (err) {
        console.warn('Failed to load translations:', err.message);
        return {};
    }
}

export { fetchTranslations };