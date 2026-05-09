export interface Image {
    id: number;
    url: string;
    position?: number;
}

export interface Pagination {
    total_items: number;
    total_pages: number;
    current_page: number;
    page_size: number;
}

export interface PaginatedResponse<T> {
    data: T[];
    pagination: Pagination;
}

export interface Vehicule {
    id: number; 
    model: string;
    description: string;
    images: Image[];
    price : number;
    year : number;
    status : number
    images_urls ?: string;
}

export interface Antiquite {
    id: number; 
    name: string;
    description: string;
    images: Image[];
    price : number;
    nouveaute ?: boolean;
    year : number;
    category: string;
    tags ?: string;
    status : number;
    size: string;
    images_urls ?: string;
}

export interface Project {
    id?: number; 
    name: string;
    description: string;
    images: Image[];
    status: number;
}

export interface Livraison {
    id?: number;
    providername: string;
    pricesmall: number | null;
    pricemedium: number | null;
    pricelarge: number | null;
    pricextralarge: number | null;
}