

function escapeRegExp(str: string) {
    return str.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
}

function replaceAll(str: string, find: string, replace: string) {
    return str.replace(new RegExp(escapeRegExp(find), 'g'), replace);
}

export function svgToDataUri(svg: string) {
    var encoded = svg.replace(/\s+/g, " ")
    
    // Sourced via: https://codepen.io/elliz/pen/ygvgay

    encoded = replaceAll(encoded, "%", "%25"); 
    encoded = replaceAll(encoded, "> <", "><"); // normalise spaces elements
    encoded = replaceAll(encoded, "; }", ";}"); // normalise spaces css
    encoded = replaceAll(encoded, "<", "%3c");
    encoded = replaceAll(encoded, ">", "%3e");
    encoded = replaceAll(encoded, "\"", "'");
    encoded = replaceAll(encoded, "#", "%23"); // needed for ie and firefox
    encoded = replaceAll(encoded, "{", "%7b");
    encoded = replaceAll(encoded, "}", "%7d");     
    encoded = replaceAll(encoded, "|", "%7c");
    encoded = replaceAll(encoded, "^", "%5e");
    encoded = replaceAll(encoded, "`", "%60"); 
    encoded = replaceAll(encoded, "@", "%40"); 
    
    var uri = 'url("data:image/svg+xml;charset=UTF-8,' + encoded + '")';
    return uri;
}
