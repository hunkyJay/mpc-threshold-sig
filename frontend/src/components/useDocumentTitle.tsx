import { useEffect } from 'react';

// Define the function with a parameter for the title of type string
const useDocumentTitle = (title: string): void => {
    useEffect(() => {
        document.title = title;
    }, [title]); // Depend on title to re-run the effect when title changes
}

export default useDocumentTitle;
