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
    price_filter = $state<number | null>(
        typeof window !== 'undefined' && localStorage.getItem('price_filter') 
            ? JSON.parse(localStorage.getItem('price_filter')!) 
            : null
    );

    setPrice_filter(price: number | null) {
        this.price_filter = price;
        this.sync('price_filter', price);
    }

    year_filter = $state<number | null>(
        typeof window !== 'undefined' && localStorage.getItem('year_filter') 
            ? JSON.parse(localStorage.getItem('year_filter')!) 
            : null
    );
        
    setYear_filter(year: number | null) {
        this.year_filter = year;
        this.sync('year_filter', year);
    }

    status_filter = $state<number | null>(
        typeof window !== 'undefined' && localStorage.getItem('status_filter') 
            ? JSON.parse(localStorage.getItem('status_filter')!) 
            : null
    );

    setStatus_filter(status: number | null) {
        this.status_filter = status;
        this.sync('status_filter', status);
    }

    category_filter = $state<string | null>(
        typeof window !== 'undefined' && localStorage.getItem('category_filter') 
            ? JSON.parse(localStorage.getItem('category_filter')!) 
            : null
    );

    setCategory_filter(category: string | null) {
        this.category_filter = category;
        this.sync('category_filter', category);
    }

    private sync(key: string, value: any) {
        if (typeof window !== 'undefined') {
            if (value === null) {
                localStorage.removeItem(key);
            } else {
                localStorage.setItem(key, JSON.stringify(value));
            }
        }
    }

    reset() {
        this.price_filter = null;
        this.year_filter = null;
        this.status_filter = null;
        this.category_filter = null;
        if (typeof window !== 'undefined') {
            ['price_filter', 'year_filter', 'status_filter', 'category_filter'].forEach(k => localStorage.removeItem(k));
        }
    }
}

export const filterStore = new FilterStore();