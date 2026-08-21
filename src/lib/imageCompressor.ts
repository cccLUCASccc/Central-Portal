export interface CompressOptions {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
    mimeType?: string;
}

/**
 * Compresse et redimensionne une image côté client via l'API Canvas.
 * Convertit par défaut en image/webp avec une qualité de 80% et max 1600px.
 */
export async function compressImageFile(
    file: File,
    options: CompressOptions = {}
): Promise<File> {
    const {
        maxWidth = 1600,
        maxHeight = 1600,
        quality = 0.8,
        mimeType = 'image/webp'
    } = options;

    // Si le fichier n'est pas une image, on le retourne tel quel
    if (!file.type.startsWith('image/')) {
        return file;
    }

    try {
        // Charger l'image dans un élément Image HTML
        const imageBitmap = await loadImage(file);

        let { width, height } = imageBitmap;

        // Calcul du ratio de redimensionnement
        if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
        }

        // Création du canvas pour le redimensionnement et l'encodage
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
            return file; // Repli vers le fichier original en cas d'erreur de contexte
        }

        // Amélioration du lissage de l'image
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(imageBitmap, 0, 0, width, height);

        // Export en Blob
        const blob = await new Promise<Blob | null>((resolve) => {
            canvas.toBlob(
                (b) => {
                    if (b) {
                        resolve(b);
                    } else {
                        // Repli sur jpeg si le format demandé échoue
                        canvas.toBlob(resolve, 'image/jpeg', quality);
                    }
                },
                mimeType,
                quality
            );
        });

        if (!blob) {
            return file;
        }

        // Remplacement du suffixe d'extension
        const extension = mimeType === 'image/webp' ? '.webp' : '.jpg';
        const baseName = file.name.replace(/\.[^/.]+$/, '');
        const newFileName = `${baseName}${extension}`;

        return new File([blob], newFileName, {
            type: blob.type || mimeType,
            lastModified: Date.now()
        });
    } catch (err) {
        console.warn('⚠️ Erreur lors de la compression de l\'image, envoi du fichier original :', err);
        return file;
    }
}

/**
 * Compresse une liste de fichiers images en parallèle.
 */
export async function compressImages(
    files: File[],
    options?: CompressOptions
): Promise<File[]> {
    return Promise.all(files.map((file) => compressImageFile(file, options)));
}

function loadImage(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);

        img.onload = () => {
            URL.revokeObjectURL(url);
            resolve(img);
        };

        img.onerror = (err) => {
            URL.revokeObjectURL(url);
            reject(err);
        };

        img.src = url;
    });
}

