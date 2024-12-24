document.querySelector('.loader-container').style.display = 'none';

async function verifierCodePostalVille(codePostal, ville) {
    const url = `https://geo.api.gouv.fr/communes?codePostal=${codePostal}&nom=${ville}`;
    try {
        const response = await fetch(url);
        const data = await response.json();
        return data.length > 0; 
    } catch (error) {
        console.error(`Erreur lors de la vérification pour ${codePostal} ${ville}:`, error);
        return false;
    }
}

async function RecupCodePostal(ville) {
    try {
        const url = `https://geo.api.gouv.fr/communes?nom=${encodeURIComponent(ville)}&boost=population&limit=5`;
        const response = await fetch(url); 
        const data = await response.json(); 

        if (data.length > 0 && data[0].codesPostaux && data[0].codesPostaux.length > 0) {
            return data[0].codesPostaux[0]; 
        } else {
            throw new Error(`Aucun code postal trouvé pour la ville: ${ville}`); 
        }
    } catch (error) {
        console.error(`Erreur dans RecupCodePostal pour la ville ${ville}:`, error.message);
        return `Erreur: Aucun code postal trouvé pour la ville ${ville}`;
    }
}

async function RecupVillesParCodePostal(codePostal) {
    try {
        const url = `https://geo.api.gouv.fr/communes?codePostal=${encodeURIComponent(codePostal)}`;
        const response = await fetch(url);
        const data = await response.json();

        if (Array.isArray(data) && data.length > 0) {
            // Créer un tableau contenant tous les noms des villes
            const nomsVilles = [];
            data.forEach(commune => nomsVilles.push(commune.nom));
            return nomsVilles; // Retourner le tableau des noms
        } else {
            throw new Error(`Aucune ville trouvée pour le code postal: ${codePostal}`);
        }
    } catch (error) {
        console.error(`Erreur dans RecupVillesParCodePostal pour le code postal ${codePostal}:`, error.message);
        return []; // Retourner un tableau vide en cas d'erreur
    }
}


function afficherMessage(type, message) {
    const messageDiv = document.getElementById('message');
    messageDiv.className = `message ${type}`;
    messageDiv.innerHTML = message; 
    messageDiv.style.display = 'block';
}

function creerCSV(data, fileName) {
    const csvContent = data.map((row) => row.join(';')).join('\n'); 
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', fileName);
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click(); 
    document.body.removeChild(link); 
}

async function traiterFichier() {
    const fileInput = document.getElementById('fileInput');
    const resultatsDiv = document.getElementById('resultats');
    const loader = document.querySelector('.loader-container');

    if (!fileInput.files.length) {
        afficherMessage('error', 'Veuillez sélectionner un fichier.');
        return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = async (event) => {
        loader.style.display = 'block'; 
        resultatsDiv.innerHTML = ''; 
        afficherMessage('', ''); 

        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        const csvData = [['Code Postal', 'Ville', 'Statut']]; 
        let valide = 0;
        let invalide = 0;

        for (let i = 1; i < rows.length; i++) {
            const [codePostal, ville] = rows[i];

            if (!codePostal || !ville) {
                resultatsDiv.innerHTML += `<p style="color: red;">Ligne ${i}: Données manquantes.</p>`;
                csvData.push([codePostal || '', ville || '', 'Données manquantes']);
                invalide++;
                continue;
            }

            const estValide = await verifierCodePostalVille(codePostal, ville);

            if (estValide) {
                resultatsDiv.innerHTML += `<p style="color: green;">Ligne ${i}: ${codePostal} - ${ville} est valide.</p>`;
                csvData.push([codePostal, ville, 'Valide']);
                valide++;
            } else {
                const newCP = await RecupCodePostal(ville); // Ajout de await ici
                resultatsDiv.innerHTML += `<p style="color: red;">Ligne ${i}: ${codePostal} - ${ville} est invalide. Nouveau code postal : ${newCP}.</p>`;
                csvData.push([newCP, ville, 'Change']);
                invalide++;
            }
        }

        loader.style.display = 'none'; 

        const total = valide + invalide;
        const resume = `
            <p><strong>Lignes traitées : ${total}</strong></p>
            <p><strong style="color: green;">${valide} valide(s)</strong>, 
            <strong style="color: red;">${invalide} invalide(s)</strong>.</p>
        `;
        afficherMessage('success', `<p>Traitement terminé !</p>${resume}`);

        creerCSV(csvData, 'fichier_corrige.csv');
    };

    reader.onerror = () => {
        loader.style.display = 'none'; 
        afficherMessage('error', 'Erreur lors de la lecture du fichier.');
    };

    reader.readAsArrayBuffer(file);
}
