
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from "@/components/ui/use-toast";
import { UploadFile, CreateFileSignedUrls } from '@/api/integrations';
import { File as ProjectFile } from '@/api/entities';
import { Upload, FileText, Loader2, Trash2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

export default function FilesManager({ project, files: initialFiles, onFilesUpdate }) {
    const { toast } = useToast();
    const [isUploading, setIsUploading] = useState(false);
    const [uploadPct, setUploadPct] = useState(0);
    const [files, setFiles] = useState(initialFiles || []);
    // Τα αρχεία είναι ΙΔΙΩΤΙΚΑ: χρειάζονται προσωρινό signed URL για προβολή.
    const [signedUrls, setSignedUrls] = useState({});

    // Sync internal state with props from parent
    useEffect(() => {
        setFiles(initialFiles || []);
    }, [initialFiles]);

    // Φόρτωση signed URLs για όλα τα αρχεία με ΕΝΑ request.
    useEffect(() => {
        const paths = (initialFiles || []).map(f => f.storage_path).filter(Boolean);
        if (!paths.length) { setSignedUrls({}); return; }
        let cancelled = false;
        CreateFileSignedUrls(paths)
            .then(urls => { if (!cancelled) setSignedUrls(urls); })
            .catch(() => { /* τα αρχεία απλώς δεν θα εμφανιστούν */ });
        return () => { cancelled = true; };
    }, [initialFiles]);

    const handleFileChange = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        setIsUploading(true);
        setUploadPct(0);
        try {
            // Ανεβαίνει ΑΠΕΥΘΕΙΑΣ στο Supabase (χωρίς το όριο 4.5MB του Vercel).
            const { storage_path } = await UploadFile({ file, onProgress: setUploadPct });

            const newFileRecord = {
                organization_id: project.organization_id,
                project_id: project.id,
                name: file.name,
                storage_path,          // ιδιωτικό μονοπάτι, όχι δημόσιο URL
                type: file.type,
                size: file.size,
                kind: file.type?.startsWith('image/') ? 'photo' : 'doc'
            };

            await ProjectFile.create(newFileRecord);
            toast({ title: "Επιτυχία!", description: "Το αρχείο ανέβηκε." });
            onFilesUpdate();
        } catch (error) {
            console.error("Failed to upload file:", error);
            toast({
                title: "Σφάλμα",
                description: error.message || "Αποτυχία ανεβάσματος αρχείου.",
                variant: "destructive"
            });
        } finally {
            setIsUploading(false);
            setUploadPct(0);
            event.target.value = '';   // ώστε να μπορεί να ξαναεπιλεγεί το ίδιο αρχείο
        }
    };
    
    const handleDeleteFile = async (fileId) => {
        try {
            await ProjectFile.delete(fileId);
            toast({ title: "Επιτυχία!", description: "Το αρχείο διαγράφηκε." });
            onFilesUpdate(); // Notify parent to refetch data
        } catch (error) {
            console.error("Failed to delete file:", error);
            toast({ title: "Σφάλμα", description: "Αποτυχία διαγραφής αρχείου.", variant: "destructive" });
        }
    };

    return (
        <Card className="bg-white/70 backdrop-blur-sm border-slate-200 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Αρχεία Έργου</CardTitle>
                <Button asChild size="sm" variant="outline">
                    <label htmlFor="file-upload">
                        {isUploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                        Ανέβασμα Αρχείου
                    </label>
                </Button>
                <Input id="file-upload" type="file" className="hidden" onChange={handleFileChange} disabled={isUploading} />
            </CardHeader>
            <CardContent>
                {isUploading && (
                    <div className="mb-4">
                        <div className="flex justify-between text-xs text-slate-500 mb-1">
                            <span>Ανέβασμα...</span>
                            <span>{uploadPct}%</span>
                        </div>
                        <Progress value={uploadPct} className="h-2" />
                    </div>
                )}
                {files && files.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {files.map(file => (
                            <div key={file.id} className="relative group">
                                <a href={signedUrls[file.storage_path] || "#"} target="_blank" rel="noopener noreferrer" className="block border rounded-lg overflow-hidden">
                                    {file.type?.startsWith('image/') && signedUrls[file.storage_path] ? (
                                        <img src={signedUrls[file.storage_path]} alt={file.name} className="w-full h-32 object-cover" />
                                    ) : (
                                        <div className="w-full h-32 bg-slate-100 flex flex-col items-center justify-center p-2">
                                            <FileText className="w-10 h-10 text-slate-500" />
                                            <p className="text-xs text-center text-slate-600 mt-2 truncate">{file.name}</p>
                                        </div>
                                    )}
                                </a>
                                <Button
                                  variant="destructive"
                                  size="icon"
                                  className="absolute top-1 right-1 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={() => handleDeleteFile(file.id)}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-slate-500 text-center py-8">Δεν υπάρχουν αρχεία για αυτό το έργο.</p>
                )}
            </CardContent>
        </Card>
    );
}
