# Supdirecte
Extension ED pour afficher une estimation son rang dans les notes.

# Installation
Téléchargez le fichier zip des [releases](https://github.com/rednixch/Supdirecte/releases).
Rendez-vous ensuite sur chrome://extensions (ou par exemple edge://extensions sur edge ou brave://extensions sur brave ) puis cliquez sur "load unpacked". Vous ajoutez ensuite le fichier zip téléchargé.

# Formule
    const facteur = ((max - value) * (nombreEleves - 1)) / (max - min);
    const ajustement = 1 + ((moyenneClasse - value) / (moyenneClasse - min));
    let classementCalcule = 1 + facteur * ajustement;

# Attention
Cette extension ne récupère aucune information qui n'est pas << affichée >> ou qui ne devrait pas être montrée. C'est juste une formule qui se sert des donnés à disposition pour fournir et afficher une estimation du rang qui se peut être grossière. Elle permet une meilleure visualisation de son niveau mais il est déconséillé de ne se baser que sur cette donnée là.
