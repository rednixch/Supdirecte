(function (xhr) {
    var XHR = XMLHttpRequest.prototype;

    var open = XHR.open;
    var send = XHR.send;
    var setRequestHeader = XHR.setRequestHeader;

    XHR.open = function (method, url) {
        this._method = method;
        this._url = url;
        this._requestHeaders = {};
        this._startTime = (new Date()).toISOString();

        return open.apply(this, arguments);
    };

    XHR.setRequestHeader = function (header, value) {
        this._requestHeaders[header] = value;
        return setRequestHeader.apply(this, arguments);
    };

    XHR.send = function (postData) {
        this.addEventListener('load', function () {
            var endTime = (new Date()).toISOString();
            var myUrl = this._url ? this._url.toLowerCase() : this._url;

            // Check if the URL contains 'note'
            if (!myUrl.includes('note')) {
                return; // Early return if the condition is not met
            }

            if (myUrl && this.responseType !== 'blob' && this.responseText) {
                try {
                    // Parse the response JSON
                    var response = JSON.parse(this.responseText);

                    let periodesData = response.data.periodes;
                    let notesData = response.data.notes;

                    // Create the final JSON structure
                    let periodes = {};

                    periodesData.forEach(periode => {
                        let nomPeriode = periode.periode;
                        let cloture = periode.cloture;
                        let disciplines = [];

                        // Iterate over each discipline in the period
                        periode.ensembleMatieres.disciplines.forEach(discipline => {
                            let disciplineName = discipline.discipline;
                            let effectif = discipline.effectif;
                            let coef = discipline.coef;
                            let prof = 'inconnu'
                            prof = discipline.professeurs?.[0]?.nom || 'inconnu';

                            // Check if moyennes exist and initialize if needed
                            let moyennes = discipline.moyenneClasse !== undefined ? {
                                classe: discipline.moyenneClasse,
                                min: discipline.moyenneMin,
                                max: discipline.moyenneMax
                            } : { classe: "", min: "", max: "" };

                            // Filter notes for the current period and discipline
                            let notes = notesData
                                .filter(note => note.codePeriode === periode.codePeriode && note.libelleMatiere.toUpperCase() === disciplineName.toUpperCase())
                                .map(note => ({
                                    id: note.id,
                                    devoir: note.devoir,
                                    typeDevoir: note.typeDevoir,
                                    date: note.date,
                                    saisie: note.dateSaisie,
                                    coef: Number(note.coef), // Ensure coef is a numeric value
                                    noteSur: Number(note.noteSur), // Ensure noteSur is a numeric value
                                    valeur: parseFloat(note.valeur.replace(',', '.')), // Convert valeur to numeric using dot
                                    moyenneClasse: parseFloat(note.moyenneClasse),
                                    minClasse: parseFloat(note.minClasse),
                                    maxClasse: parseFloat(note.maxClasse),
                                    effectif: effectif // Include effectif for ranking calculation
                                }));

                            // Calculate the average using the helper function
                            const average = calculateAverage(notes);

                            // Calculate the standard deviation (stability)
                            const stability = calculateStandardDeviation(notes);

                            // Convert moyennes values to numeric or null if they are empty strings
                            const classe = moyennes.classe === "" ? null : parseFloat(moyennes.classe.replace(',', '.')); // Convert to numeric or null
                            const min = moyennes.min === "" ? null : parseFloat(moyennes.min.replace(',', '.')); // Convert to numeric or null
                            const max = moyennes.max === "" ? null : parseFloat(moyennes.max.replace(',', '.')); // Convert to numeric or null

                            const rankedNotes = notes.map(note => {
                                const noteRank = estimateRanks(
                                    note.valeur,
                                    note.minClasse,
                                    note.maxClasse,
                                    note.effectif,
                                    note.moyenneClasse
                                );

                                // Calculate the impact on average considering the coefficient
                                const normalizedNoteValue = (note.valeur / note.noteSur) * 20; // Normalize to 20-point scale
                                const impactOnAverage = average !== null ? ((normalizedNoteValue - average) * note.coef).toFixed(2) : null; // Impact calculation

                                return { ...note, classement: noteRank, impact: Number(impactOnAverage) }; // Add impact to each note
                            });

                            // Calculate the discipline rank
                            const disciplineRank = estimateDisciplineRank({
                                effectif: effectif,
                                coef: coef,
                                moyennes: {
                                    classe: classe,
                                    min: min,
                                    max: max,
                                    user: average !== null ? Number(Number(average).toString()) : null // Convert average to string to remove trailing zeros
                                }
                            });

                            // Add the discipline structure to the disciplines array
                            disciplines.push({
                                [disciplineName]: {
                                    effectif: effectif,
                                    coef: coef, // coef should remain as is; assumed to be numeric
                                    rank: disciplineRank, // Add discipline rank
                                    prof: prof,
                                    moyennes: {
                                        classe: classe,
                                        min: min,
                                        max: max,
                                        user: average !== null ? Number(Number(average).toString()) : null // Convert average to string to remove trailing zeros
                                    },
                                    stability: Number(Number(stability).toString()), // Add stability (standard deviation)
                                    notes: rankedNotes // Use ranked notes
                                }
                            });
                        });

                        // Add the period structure to the final periodes object
                        periodes[nomPeriode] = {
                            cloture: cloture,
                            disciplines: disciplines
                        };
                    });

                    // Store the final structured data in sessionStorage
                    sessionStorage.setItem('periodesData', JSON.stringify({ periodes: periodes }));
                    console.log('Saved periodes data to sessionStorage:', { periodes: periodes });
                } catch (err) {
                    console.log("Error processing the response body");
                    console.log(err);
                }
            }
        });

        return send.apply(this, arguments);
    };

})(XMLHttpRequest);

// Function to calculate average
function calculateAverage(notes) {
    let totalMarks = 0; // Total weighted marks
    let totalCoefficients = 0; // Total coefficients

    notes.forEach(note => {
        const noteValue = note.valeur; // This is already converted to numeric above
        const coefficient = note.coef; // This is already numeric
        const noteOutOf = note.noteSur; // This is already numeric

        if (noteOutOf > 0) {
            const normalizedMark = (noteValue / noteOutOf) * 20; // Normalize to a 20-point scale
            totalMarks += normalizedMark * coefficient; // Update total marks
            totalCoefficients += coefficient; // Update total coefficients
        } else {
            console.warn(`Invalid 'noteSur' value for discipline. Note value: ${noteValue}`);
        }
    });

    // Calculate average if total coefficients are greater than zero
    return totalCoefficients > 0 ? (totalMarks / totalCoefficients).toFixed(2) : null; // Returns average or null
}

// Function to calculate rankings
function estimateRanks(value, min, max, nombreEleves, moyenneClasse) {
    // Check if any required data is missing
    if (value === null || min === null || max === null || nombreEleves === null || moyenneClasse === null) {
        return null; // Return null if unable to calculate rank
    }

    if (value === max) {
        return 1; // Best rank if value is the maximum
    }
    if (value === min) {
        return nombreEleves; // Worst rank if value is the minimum
    }

    const facteur = ((max - value) * (nombreEleves - 1)) / (max - min);
    const ajustement = 1 + ((moyenneClasse - value) / (moyenneClasse - min));
    let classementCalcule = 1 + facteur * ajustement;
    classementCalcule = Math.round(classementCalcule);

    if (classementCalcule <= 1) {
        return 2; // Adjust to avoid being first if necessary
    } else if (classementCalcule >= nombreEleves) {
        return nombreEleves - 1; // Adjust to avoid being last if necessary
    }

    return classementCalcule;
}

// Function to calculate discipline rank
function estimateDisciplineRank(discipline) {
    const { coef, moyennes, effectif } = discipline;
    const { classe, min, max, user } = moyennes;

    // Check if required data is missing
    if (user === null || min === null || max === null || effectif === null || classe === null) {
        return null; // Return null if unable to calculate discipline rank
    }

    // Calculate rank for the discipline using the same function
    return estimateRanks(
        user,
        min,
        max,
        effectif,
        classe
    );
}

// Function to calculate standard deviation
function calculateStandardDeviation(notes) {
    if (notes.length === 0) return null; // Return null if there are no notes

    // Calculate the average first
    const average = calculateAverage(notes);
    if (average === null) return null; // Return null if unable to calculate average

    // Calculate the variance
    const variance = notes.reduce((acc, note) => {
        const normalizedMark = (note.valeur / note.noteSur) * 20; // Normalize to a 20-point scale
        return acc + Math.pow(normalizedMark - average, 2);
    }, 0) / notes.length;

    // Return the square root of the variance (standard deviation)
    return Math.sqrt(variance).toFixed(2);
}