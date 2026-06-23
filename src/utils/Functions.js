export function generateRandomFileName() {
    const randomNumber = Math.floor(10000000 + Math.random() * 90000000);
    return 'frame' + randomNumber + '.jpg';
}

export function formatTitleToDB(title) {
    return title.replace("'", '%q');
}

export function formatTitleToDisplay(title) {
    return title.replace('%q', "'");
}
