export interface Image {
    id: number;
    url: string;
    position?: number;
}

export interface Vehicule {
    id: number; 
    model: string;
    description: string;
    images: Image[];
    price : number;
    sold ?: boolean;
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
    sold ?: boolean;
    year : number;
    category: string;
    status : number
    images_urls ?: string;
}

export interface Project {
    id?: number; 
    name: string;
    description: string;
    images: Image[];
    status: number;
}