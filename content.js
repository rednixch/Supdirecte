
const observer = new MutationObserver((mutationsList) => {
    mutationsList.forEach(mutation => {
        if (mutation.type === 'childList') {
            const tableElement = document.querySelector(`.releve`);
            if (tableElement) {
                if (sessionStorage.getItem('supActivated') === 'true') return;
                sessionStorage.setItem('supActivated', 'true')
                console.log('ACTIVATED')
                let periodesJson = JSON.parse(sessionStorage.getItem('periodesData'));

                // Get the current période from the <span> inside the <a> element with aria-selected="true"
                const selectedPeriodeElement = document.querySelector('a[aria-selected="true"] span');
                if (!selectedPeriodeElement) {
                    console.warn("Current période not found on the page.");
                    return;
                }
                const currentPeriode = selectedPeriodeElement.textContent.trim();

                // Extract the current période and its notes
                let periodeData = periodesJson.periodes[currentPeriode];
                if (!periodeData) {
                    console.warn(`Période "${currentPeriode}" not found in the data.`);
                    return;
                }

                // Collect all notes across disciplines in the current période
                let allNotes = [];
                periodeData.disciplines.forEach(discipline => {
                    let disciplineName = Object.keys(discipline)[0];
                    let disciplineData = discipline[disciplineName];
                    if (disciplineData && disciplineData.notes) {
                        allNotes = allNotes.concat(disciplineData.notes.map(note => ({
                            ...note,
                            libelleMatiere: disciplineName,
                            effectif: disciplineData.effectif
                        })));
                    }
                });

                addRanksToMarks(periodeData); // Run your function here
                addRanksToDisciplines(periodeData)
                addStablityToDiscipline(periodeData)
                stylishTable();
                setAverages(periodeData)
                addBadgesToMarks(periodeData)

                document.querySelector('#onglets-periodes').addEventListener('click', function () {
                    sessionStorage.setItem('supActivated', 'false');
                })

            } else {
                sessionStorage.setItem('supActivated', 'false')
            }
        }
    });
});


function stylishTable() {
    document.querySelectorAll('.professeur').forEach(element => {
        element.remove();
    });
}

function runScriptWhenTableAppears() {
    // Observe changes to the body for addition of the table element
    sessionStorage.setItem('supActivated', 'false')
    observer.observe(document.body, { childList: true, subtree: true });
}

window.onload = function () {
    runScriptWhenTableAppears();
}

function setAverages(periodesData) {
    // Iterate over each discipline in the periode data
    periodesData.disciplines.forEach(discipline => {
        const disciplineName = Object.keys(discipline)[0]; // Get the name of the discipline
        const disciplineData = discipline[disciplineName]; // Access the discipline data

        const moyenneSpan = getMoyenne(disciplineName); // Get the span for displaying the average

        // Retrieve the user average from the discipline's moyennes
        const userAverage = disciplineData.moyennes.user;

        // Set the average in the span
        if (moyenneSpan) {
            moyenneSpan.textContent = userAverage; // Update the span with the formatted average
        } else {
            console.warn(`Moyenne span not found for discipline "${disciplineName}".`);
        }
    });
}



// Function to format date to "jeudi 1er septembre"
function formatDateToFrench(dateString) {
    const date = new Date(dateString);
    const options = { weekday: 'long', day: 'numeric', month: 'long' };
    let formattedDate = date.toLocaleDateString('fr-FR', options);

    // Add "er" to the day if it's the 1st of the month
    if (date.getDate() === 1) {
        formattedDate = formattedDate.replace(' 1 ', ' 1er ');
    }

    return formattedDate;
}

function getNote(typeDevoir, devoir, date) {
    // Format the date to the required format, e.g., "jeudi 12 septembre"
    const formattedDate = formatDateToFrench(date);

    // Construct the aria-label value
    const ariaLabel = `Ouvrir le détail : ${typeDevoir} - ${devoir.replace(/"/g, '\\"')} - du ${formattedDate}`;

    // Use querySelector to find the note button using the constructed aria-label
    const noteButton = document.querySelector(`button[title="${ariaLabel}"]`);

    // If the note button exists, return it
    if (noteButton) {
        return noteButton; // Return the note button element directly
    } else {
        console.warn("Note button not found with the given aria-label " + ariaLabel);
        return null; // Return null if the note button is not found
    }
}

function addRanksToDisciplines(periodeData) {
    // Iterate through each discipline in the period data
    periodeData.disciplines.forEach(discipline => {
        const disciplineName = Object.keys(discipline)[0]; // Get the discipline name
        const disciplineData = discipline[disciplineName]; // Get the discipline data

        // Get the discipline element on the page using getDiscipline
        const disciplineElement = getDiscipline(disciplineName);

        // Ensure the discipline element exists and the rank is available
        if (disciplineElement && disciplineData.rank !== null) {
            // Create a span element for the rank
            const spanRang = document.createElement('span');
            spanRang.className = 'rang';
            spanRang.setAttribute('style', 'margin-right: 5px')
            spanRang.textContent = disciplineData.rank; // Use the rank from disciplineData

            // Apply ranking styles based on the rank
            if (disciplineData.rank === 1) {
                spanRang.classList.add('elite');
            } else if (disciplineData.rank === 2 || disciplineData.rank === 3) {
                spanRang.classList.add('podium');
            }

            // Insert the ranking element before the first child of the discipline element
            disciplineElement.insertBefore(spanRang, disciplineElement.firstChild);

            disciplineElement.addEventListener('click', function () {

                let md_content = `
                <div class="container-bg simple-padding">
                <h4>${disciplineName}</h4>
                <div class="margin-bottom">
                <div><span class="text-bold">Professeur :</span>
                <span class="margin-whitespace">${disciplineData.prof}</span>
                </div>
                <div><span class="text-bold">Coef :</span>
                <span class="margin-whitespace">${disciplineData.coef}</span>
                </div>
                <div><span class="text-bold">Nombre d'élèves :</span>
                <span class="margin-whitespace">${disciplineData.effectif}</span>
                </div>
                <div><span class="text-bold">Stabilité :</span>
                <span class="margin-whitespace">${getStabilitySign(disciplineData.stability)} ${getStabilityName(disciplineData.stability)} (écart type: ${disciplineData.stability})</span>
                </div>
                </div></div>
                `
                showModal('DÉTAIL DE LA DISCIPLINE', md_content)

                makeGraph(disciplineData.rank, disciplineData.moyennes.max, disciplineData.moyennes.min, disciplineData.effectif, disciplineData.moyennes.user)
                //alert(`${disciplineName}\nProfesseur: ${disciplineData.prof}\nCoef: ${disciplineData.coef}\nNombre d'élèves: ${disciplineData.effectif}\nRang (éstimé): ${disciplineData.rank}`)
            })

        } else {
            disciplineElement.addEventListener('click', function () {

                let md_content = `
                <div class="container-bg simple-padding">
                <h4>${disciplineName} (sans note)</h4>
                <div class="margin-bottom">
                <div><span class="text-bold">Professeur :</span>
                <span class="margin-whitespace">${disciplineData.prof}</span>
                </div>
                <div><span class="text-bold">Coef :</span>
                <span class="margin-whitespace">${disciplineData.coef}</span>
                </div>
                <div><span class="text-bold">Nombre d'élèves :</span>
                <span class="margin-whitespace">Non-déterminé</span>
                </div>
                <div><span class="text-bold">Stabilité :</span>
                <span class="margin-whitespace">Non-déterminé</span>
                </div>
                </div></div>
                `

                showModal('DÉTAIL DE LA DISCIPLINE', md_content)
            })
        }
    });
}


function getDiscipline(discipline) {
    // Select all span elements with class 'nommatiere'
    const spans = document.querySelectorAll('span.nommatiere');

    // Iterate over each span to find one that has a b child with matching text content
    for (const span of spans) {
        const bElement = span.querySelector('span');
        if (bElement && bElement.textContent.trim() === discipline) {
            return span; // Return the matching span element
        }
    }

    return null; // Return null if no matching span is found
}

function getMoyenne(discipline) {
    // Récupère la table avec classe 'table releve ed-table mb-0'
    const table = document.querySelector('.table.releve.ed-table.mb-0');
    if (!table) {
        console.warn("Table not found.");
        return null; // Retourne null si la table n'existe pas
    }

    // Trouve le tbody de la table
    const tbody = table.querySelector('tbody');
    if (!tbody) {
        console.warn("Table body not found.");
        return null; // Retourne null si le tbody n'existe pas
    }

    // Parcourt les lignes du tableau
    const rows = tbody.querySelectorAll('tr'); // Récupère toutes les lignes dans le tbody
    for (const row of rows) {
        // Trouve la discipline dans la colonne correspondante
        const nomMatiereSpan = row.querySelector('span.nommatiere > span.text-bold'); // Sélectionne le span contenant le nom de la matière
        if (nomMatiereSpan && nomMatiereSpan.textContent.trim() === discipline) {
            // Une fois trouvée, recherche la moyenne
            const moyenneElement = row.querySelector('td.relevemoyenne > span.ng-star-inserted'); // Sélectionne le span contenant la moyenne
            if (moyenneElement) {
                return moyenneElement.textContent.trim(); // Retourne le texte de la moyenne
            } else {
                console.warn("Moyenne element not found.");
                return null; // Retourne null si la moyenne n'existe pas
            }
        }
    }

    console.warn(`Discipline "${discipline}" not found.`);
    return null; // Retourne null si la discipline n'est pas trouvée
}


// Function to add rankings to the notes on the page
function addRanksToMarks(periodeData) {
    // Iterate through each discipline in the period data
    periodeData.disciplines.forEach(discipline => {
        const disciplineName = Object.keys(discipline)[0]; // Get the discipline name
        const notes = discipline[disciplineName].notes; // Get the notes for the discipline

        // Iterate through each note in the discipline
        notes.forEach(item => {
            let noteButton = getNote(item.typeDevoir, item.devoir, item.date);

            // Ensure the noteButton exists and does not already have a ranking element
            if (noteButton) {
                const valeurSpan = noteButton.querySelector('.valeur');

                // Only proceed if the .valeur element exists and doesn't already have a ranking
                if (valeurSpan && !valeurSpan.querySelector('.rang')) {
                    const spanRang = document.createElement('span');
                    spanRang.className = 'rang';
                    spanRang.textContent = item.classement; // Use the classement from the item

                    // Apply ranking styles based on the classement
                    if (item.classement === 1) {
                        spanRang.classList.add('elite');
                    } else if (item.classement === 2 || item.classement === 3) {
                        spanRang.classList.add('podium');
                    }

                    // Insert the ranking element at the beginning of the .valeur span
                    valeurSpan.insertBefore(spanRang, valeurSpan.firstChild);
                }

                noteButton.addEventListener('click', function () {
                    addImpactToModal(item.impact)
                    makeGraph(item.classement, item.maxClasse, item.minClasse, item.effectif, item.valeur, item.saisie)
                })
            }
        });
    });
}

// Function to determine the badge text based on the impact value
// Function to determine the badge text based on the impact value
function getBadgeSign(impact) {
    if (impact === null || impact === 0) {
        return ""; // No badge if impact is null or zero
    } else if (impact > 0 && impact <= 0.45) {
        return ""; // No badge for very low positive impact
    } else if (impact > 0.45 && impact <= 2) {
        return "🔥"; // Good impact
    } else if (impact > 2 && impact <= 4) {
        return "🔥🔥"; // Really good impact
    } else if (impact > 4) {
        return "🔥🔥🔥"; // Excellent impact
    } else if (impact < 0 && impact >= -0.45) {
        return ""; // No badge for very low negative impact
    } else if (impact < -0.45 && impact >= -2) {
        return "💧"; // Bad impact
    } else if (impact < -2 && impact >= -4) {
        return "💧💧"; // Really bad impact
    } else if (impact < -4) {
        return "💧💧💧"; // Horrible impact
    }
    return ""; // Fallback for any unexpected value
}

function getBadgeText(impact) {
    if (impact === null || impact === 0) {
        return "Sans impact"; // No badge if impact is null or zero
    } else if (impact > 0 && impact <= 0.45) {
        return "Très léger impact positif"; // No badge for very low positive impact
    } else if (impact > 0.45 && impact <= 2) {
        return "Bon impact"; // Good impact
    } else if (impact > 2 && impact <= 4) {
        return "Très bon impact"; // Really good impact
    } else if (impact > 4) {
        return "Exellent impact"; // Excellent impact
    } else if (impact < 0 && impact >= -0.45) {
        return "Très léger impact négatif"; // No badge for very low negative impact
    } else if (impact < -0.45 && impact >= -2) {
        return "Mauvais impact"; // Bad impact
    } else if (impact < -2 && impact >= -4) {
        return "Très mauvais impact (mais tu peux te ratrapper 👍 la note la plus importante c'est la prochaine)"; // Really bad impact
    } else if (impact < -4) {
        return "Horrible impact (mais tu peux te ratrapper 👍 la note la plus importante c'est la prochaine)"; // Horrible impact
    }
    return ""; // Fallback for any unexpected value
}


// Function to add rankings to the notes on the page
function addBadgesToMarks(periodeData) {
    // Iterate through each discipline in the period data
    periodeData.disciplines.forEach(discipline => {
        const disciplineName = Object.keys(discipline)[0]; // Get the discipline name
        const notes = discipline[disciplineName].notes; // Get the notes for the discipline

        // Iterate through each note in the discipline
        notes.forEach(item => {
            let noteButton = getNote(item.typeDevoir, item.devoir, item.date);

            // Ensure the noteButton exists and does not already have a ranking element
            if (noteButton) {
                const valeurSpan = noteButton.querySelector('.valeur');

                // Only proceed if the .valeur element exists and doesn't already have a ranking
                if (valeurSpan) {
                    const impact = item.impact; // Get the impact value
                    const badgeText = getBadgeSign(impact); // Get the corresponding badge text

                    if (badgeText) {
                        const spanBadges = document.createElement('span');
                        spanBadges.className = 'badges';
                        spanBadges.textContent = badgeText;

                        // Append the badges to the mark
                        valeurSpan.append(spanBadges); // Append badges to the .valeur element
                    }
                }
            }
        });
    });
}

// Function to add rankings to the notes on the page
function addImpactToModal(impact) {
    const container = document.createElement('div');
    container.className = 'container-bg simple-padding';

    // Create the h4 element with the text "RANG"
    const heading = document.createElement('h4');
    heading.textContent = 'IMPACT SUR LA MOYENNE';

    const impacts = document.createElement('span')
    impacts.setAttribute('class','impacts')
    impacts.textContent = `${getBadgeSign(impact)} ${impact} : ${getBadgeText(impact)}`

    container.append(heading, impacts)

    document.querySelector('.modal-body').append(container)
}

function getStabilityName(stability) {
    if (stability <= 0.5) {
        return 'stable'; // Stable
    } else if (stability <= 1.0) {
        return 'légèrement instable'; // Légèrement instable
    } else if (stability <= 1.5) {
        return 'instable'; // Instable
    } else if (stability <= 2.0) {
        return 'très instable'; // Très instable
    } else {
        return 'extrêmement instable'; // Extrêmement instable
    }
}

function getStabilitySign(stability) {
    if (stability <= 0.5) {
        return '='; // Stable
    } else if (stability <= 1.0) {
        return '≈'; // Légèrement instable
    } else if (stability <= 1.5) {
        return '≈!'; // Instable
    } else if (stability <= 2.0) {
        return '≈!!'; // Très instable
    } else {
        return '≈!!!'; // Extrêmement instable
    }
}

function addStablityToDiscipline(periodeData) {
    // Iterate through each discipline in the period data
    periodeData.disciplines.forEach(discipline => {
        const disciplineName = Object.keys(discipline)[0]; // Get the discipline name
        const disciplineData = discipline[disciplineName]; // Get the discipline data

        // Get the discipline element on the page using getDiscipline
        const disciplineElement = getDiscipline(disciplineName);

        // Ensure the discipline element exists and the rank is available
        if (disciplineElement && disciplineData.stability !== null) {

            let stability = disciplineData.stability;
            const stabilitySign = getStabilitySign(stability); // Get the corresponding sign

            // Create a span element for the stability sign
            const spanStability = document.createElement('span');
            spanStability.className = 'stability';
            spanStability.setAttribute('style', 'margin-left: 5px');
            spanStability.textContent = stabilitySign; // Set the sign as text content

            // Insert the stability element before the first child of the discipline element
            disciplineElement.append(spanStability);
        }
    });
}

function makeGraph(classement, maxClasse, minClasse, effectif, valeur, saisie) {
    // Create the outer div with classes "container-bg" and "simple-padding"
    const container = document.createElement('div');
    container.className = 'container-bg simple-padding';

    // Create the h4 element with the text "RANG"
    const heading = document.createElement('h4');
    heading.textContent = 'RANG ÉSTIMÉ';

    // Create the div with the class "canvas-container"
    const canvasContainer = document.createElement('div');
    canvasContainer.className = 'canvas-container';

    // Create the canvas element with the specified ID, width, and height
    const canvas = document.createElement('canvas');
    canvas.id = 'rankCanvas';
    canvas.width = 600;
    canvas.height = 100;

    // Append the canvas to the div container
    canvasContainer.appendChild(canvas);

    const rangWarning = document.createElement('span')
    rangWarning.setAttribute('class', 'rangWarning')
    rangWarning.innerHTML = `👥 Vous pouvez être ex-aequo<br>⚠ Il s'agit d'une estimation - votre rang peut légèrement différer dans la réalité`

    // Append the heading and the canvas container to the outer container
    container.appendChild(heading);
    container.appendChild(rangWarning)
    container.appendChild(canvasContainer);

    const lastSaisie = document.createElement('span')
    lastSaisie.setAttribute('class', 'lastSaisie')
    if (saisie) {
        lastSaisie.textContent = `🔄 Dernière modification du professeur le ${formatDateToFrench(saisie)}`
    }

    // Append the outer container to the body
    document.querySelector('.modal-body').appendChild(container);
    if (saisie) {
        document.querySelector('.margin-bottom').appendChild(lastSaisie);
    }
    // Get the canvas context and draw the visualization
    const canvasc = document.getElementById("rankCanvas");
    const ctx = canvasc.getContext("2d");

    const canvasWidth = ctx.canvas.width;
    const canvasHeight = ctx.canvas.height;

    // Positions for the ranks
    const minX = 50; // Start position for the worst rank
    const maxX = canvasWidth - 50; // End position for the best rank
    const userX = minX + (maxX - minX) * (effectif - classement) / (effectif - 1);

    // Line settings
    ctx.strokeStyle = "black";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(minX, canvasHeight / 2);
    ctx.lineTo(maxX, canvasHeight / 2);
    ctx.stroke();

    // Draw circles
    drawCircle(ctx, minX, canvasHeight / 2, 20, "black", effectif, minClasse);
    drawCircle(ctx, maxX, canvasHeight / 2, 20, "black", 1, maxClasse);
    drawCircle(ctx, userX, canvasHeight / 2, 25, "red", classement, valeur);

    // Helper function to draw a circle
    function drawCircle(ctx, x, y, radius, color, rank, mark) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, 2 * Math.PI);
        ctx.fill();

        // Add the rank inside the circle
        ctx.fillStyle = "white";
        ctx.font = "16px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(rank, x, y);

        // Add the mark below the circle
        ctx.fillStyle = "black";
        ctx.font = "14px Arial";
        ctx.fillText(mark, x, y + radius + 15);
    }


}

function showModal(title, content) {
    document.body.classList.add('modal-open');
    document.body.setAttribute('style', 'padding-right: 0px; overflow-y: hidden;');

    let backdrop = document.createElement('bs-modal-backdrop');
    backdrop.setAttribute('class', 'modal-backdrop fade in');

    let modal_container = document.createElement('modal-container');
    modal_container.setAttribute('role', 'dialog');
    modal_container.setAttribute('tabindex', '-1');
    modal_container.setAttribute('class', 'modal fade');
    modal_container.setAttribute('style', 'display: block;');

    // Prevent hiding if clicked inside the modal content
    modal_container.addEventListener('click', (event) => {
        if (event.target === modal_container) {
            hideModal();
        }
    });

    let modal_document = document.createElement('div');
    modal_document.setAttribute('role', 'document');
    modal_document.setAttribute('class', 'modal-dialog modal-lg');

    modal_container.append(modal_document);

    let modal_content = document.createElement('div');
    modal_content.setAttribute('class', 'modal-content');

    modal_document.append(modal_content);

    let detail_devoir = document.createElement('ed-detail-devoir');

    modal_content.append(detail_devoir);

    let detail_devoir_encore = document.createElement('div');
    detail_devoir_encore.setAttribute('id', 'detail-devoir');

    detail_devoir.append(detail_devoir_encore);

    let modal_header = document.createElement('div');
    modal_header.setAttribute('class', 'modal-header');

    let modal_title = document.createElement('h3');
    modal_title.setAttribute('class', 'modal-title');
    modal_title.textContent = title;

    let close_btn = document.createElement('button');
    close_btn.setAttribute('type', 'button');
    close_btn.setAttribute('aria-label', 'Fermer cette fenêtre');
    close_btn.addEventListener('click', hideModal)

    modal_header.append(modal_title, close_btn);

    close_btn.setAttribute('class', 'btn-close d-print-none');

    let modal_body = document.createElement('div');
    modal_body.setAttribute('class', 'modal-body');
    modal_body.innerHTML = content;

    let modal_footer = document.createElement('div');
    modal_footer.setAttribute('class', 'modal-footer');

    detail_devoir_encore.append(modal_header, modal_body, modal_footer);

    let close_btn_big = document.createElement('button');
    close_btn_big.setAttribute('type', 'button');
    close_btn_big.setAttribute('aria-label', 'Fermer cette fenêtre');
    close_btn_big.setAttribute('class', 'btn btn-primary d-print-none');
    close_btn_big.setAttribute('style', 'margin-top: 15px;');
    close_btn_big.textContent = 'Fermer';
    close_btn_big.addEventListener('click', hideModal)

    modal_footer.append(close_btn_big);

    document.body.append(backdrop, modal_container);

    // Add 'show' class to modal_container after 100 ms
    setTimeout(() => {
        modal_container.classList.add('show');
    }, 100);
}


function hideModal() {
    let modal = document.querySelector('.modal')
    let backdrop = document.querySelector('.modal-backdrop')

    modal.classList.remove('show')

    setTimeout(() => {
        backdrop.classList.remove('show')
    }, 100);

    setTimeout(() => {
        backdrop.remove()
        modal.remove()
        document.body.classList.remove('modal-open');
        document.body.style = 'padding-right: 0px;'
    }, 200);
}