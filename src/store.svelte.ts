import type { Project } from "./type";

class ProjectStore {
    selectedProject = $state<Project | null>(
        typeof window !== 'undefined' && localStorage.getItem('selectedProject') 
            ? JSON.parse(localStorage.getItem('selectedProject')!) 
            : null
    );

    setSelectedProject(project: Project) {
        this.selectedProject = project;
        if (typeof window !== 'undefined') {
            localStorage.setItem('selectedProject', JSON.stringify(project));
        }
    }
}

export const projectStore = new ProjectStore();


class FilterStore {
    price_filter = $state<number | null>(null);
    year_filter = $state<number | null>(null);
    status_filter = $state<number | null>(null);
    nouveaute_filter = $state<boolean | null>(null);
    category_filter = $state<string | null>(null);

    initFromUrl() {
        if (typeof window === 'undefined') return;
        const params = new URLSearchParams(window.location.search);
        
        const price = params.get('priceMax');
        this.price_filter = price ? Number(price) : null;
        
        const status = params.get('status');
        this.status_filter = status ? Number(status) : null;
        
        const nouveaute = params.get('nouveaute');
        this.nouveaute_filter = nouveaute ? nouveaute === 'true' : null;
        
        const category = params.get('category');
        this.category_filter = category || null;
    }

    setPrice_filter(price: number | null) {
        this.price_filter = price;
    }

    setYear_filter(year: number | null) {
        this.year_filter = year;
    }

    setStatus_filter(status: number | null) {
        this.status_filter = status;
    }

    setNouveaute_filter(nouveaute: boolean | null) {
        this.nouveaute_filter = nouveaute;
    }

    setCategory_filter(category: string | null) {
        this.category_filter = category;
    }

    reset() {
        this.price_filter = null;
        this.year_filter = null;
        this.status_filter = null;
        this.nouveaute_filter = null;
        this.category_filter = null;
    }
}

export const filterStore = new FilterStore();