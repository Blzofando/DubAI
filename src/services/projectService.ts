import {
    collection,
    doc,
    setDoc,
    getDoc,
    getDocs,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    Timestamp,
    serverTimestamp
} from 'firebase/firestore';
// import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'; // Storage removed
import { db } from '@/lib/firebase';
import type { Project, CreateProjectData } from '@/types/project';

const PROJECTS_COLLECTION = 'projects';

/**
 * Criar novo projeto
 */
export async function createProject(data: CreateProjectData): Promise<string> {
    try {
        const projectRef = doc(collection(db, PROJECTS_COLLECTION));
        const projectId = projectRef.id;

        const projectData: Omit<Project, 'id'> = {
            ...data,
            transcriptSegments: data.transcriptSegments || [],
            translatedSegments: data.translatedSegments || [],
            duration: data.duration || 0,
            selectedVoice: data.selectedVoice || 'nova',
            createdAt: serverTimestamp() as Timestamp,
            updatedAt: serverTimestamp() as Timestamp,
        };

        await setDoc(projectRef, projectData);
        return projectId;
    } catch (error: any) {
        console.error('Error creating project:', error);
        throw new Error('Falha ao criar projeto');
    }
}

/**
 * Atualizar projeto existente
 */
export async function updateProject(projectId: string, data: Partial<Project>): Promise<void> {
    try {
        const projectRef = doc(db, PROJECTS_COLLECTION, projectId);
        await updateDoc(projectRef, {
            ...data,
            updatedAt: serverTimestamp()
        });
    } catch (error: any) {
        console.error('Error updating project:', error);
        throw new Error('Falha ao atualizar projeto');
    }
}

/**
 * Buscar projeto por ID
 */
export async function getProject(projectId: string): Promise<Project | null> {
    try {
        const projectRef = doc(db, PROJECTS_COLLECTION, projectId);
        const projectSnap = await getDoc(projectRef);

        if (!projectSnap.exists()) {
            return null;
        }

        return {
            id: projectSnap.id,
            ...projectSnap.data()
        } as Project;
    } catch (error: any) {
        console.error('Error getting project:', error);
        throw new Error('Falha ao buscar projeto');
    }
}

/**
 * Listar todos os projetos do usuário
 */
export async function getUserProjects(userId: string): Promise<Project[]> {
    try {
        const projectsQuery = query(
            collection(db, PROJECTS_COLLECTION),
            where('userId', '==', userId)
            // orderBy('updatedAt', 'desc') // Re-enable after index creation
        );

        const querySnapshot = await getDocs(projectsQuery);
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as Project));
    } catch (error: any) {
        console.error('Error getting user projects:', error);
        throw new Error('Falha ao buscar projetos');
    }
}

/**
 * Deletar projeto
 */
export async function deleteProject(projectId: string, userId: string): Promise<void> {
    try {
        // Delete Firestore document
        const projectRef = doc(db, PROJECTS_COLLECTION, projectId);
        await deleteDoc(projectRef);

        // Storage cleanup removed (No Storage access)

    } catch (error: any) {
        console.error('Error deleting project:', error);
        throw new Error('Falha ao deletar projeto');
    }
}

/**
 * Upload de arquivo para Storage (DISABLED)
 */
export async function uploadFile(
    file: Blob | File,
    path: string,
    onProgress?: (progress: number) => void
): Promise<string> {
    // Storage Disabled
    return '';
}

/**
 * Verificar se nome do projeto já existe para o usuário
 */
export async function projectNameExists(userId: string, projectName: string): Promise<boolean> {
    try {
        const projectsQuery = query(
            collection(db, PROJECTS_COLLECTION),
            where('userId', '==', userId),
            where('name', '==', projectName)
        );

        const querySnapshot = await getDocs(projectsQuery);
        return !querySnapshot.empty;
    } catch (error: any) {
        console.error('Error checking project name:', error);
        return false;
    }
}
