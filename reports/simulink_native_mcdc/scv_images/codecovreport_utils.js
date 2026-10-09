// Copyright 2014-2026 The MathWorks, Inc.

(function () {
    // Private object for storing a ref and its tooltip
    var href2Span = {};

    // Helper function to check if this is a sanitizer report
    // (the string 'Sanitizer' is never translated then uses it to identify the report)
    function isSanitizerReport () {
        try {
            var title = document.title;
            if (!title) {
                return false;
            }
            return title.indexOf('Sanitizer') !== -1;
        } catch (err) {
            return false;
        }
    }

    // Private function for extracting the recognized ref
    // (only href like #funX, #nodeX and #covX are supported)
    function getCandidateRef (href) {
        var res;
        try {
            if ((typeof (href) === 'string') && (href.length > 4)) {
                var ref = href.substring(1, 4);
                if ((ref === 'fun') || (ref === 'cov') || (ref === 'nod')) {
                    res = href.substring(1);
                }
            }
        } catch (err) {
        }
        return res;
    }

    // Helper function to find other coverage elements on the same line
    // Returns an array of other cov references that share the same line href
    function findOtherCoverageRefs(mainRef) {
        var otherRefs = [];
        try {
            // Find the anchor element with name="covX"
            var mainAnchor = document.getElementsByName(mainRef)[0];
            if (!mainAnchor) {
                return otherRefs;
            }

            // Get the href from the next h4 element
            var mainHref = null;
            var mainNextElem = mainAnchor.nextElementSibling || mainAnchor.nextSibling;
            if (mainNextElem && mainNextElem.tagName && (mainNextElem.tagName.toUpperCase() === 'H4')) {
                // Find the first <a> tag with href attribute inside the h4
                var mainLinks = mainNextElem.getElementsByTagName('a');
                for (var j = 0; j < mainLinks.length; j++) {
                    var href = mainLinks[j].getAttribute('href');
                    if (href) {
                        mainHref = href;
                        break;
                    }
                }
            }

            if (!mainHref) {
                return otherRefs;
            }

            // Find all anchor elements with name starting with "cov"
            var allAnchors = document.getElementsByTagName('a');
            for (var i = 0; i < allAnchors.length; i++) {
                var anchor = allAnchors[i];
                var name = anchor.getAttribute('name');

                // Check if name starts with "cov" and is different from mainRef
                if (name && (name.indexOf('cov') === 0) && (name !== mainRef)) {
                    // Check if the next element is h4 with matching href
                    var otherNextElem = anchor.nextElementSibling || anchor.nextSibling;
                    if (otherNextElem && otherNextElem.tagName && (otherNextElem.tagName.toUpperCase() === 'H4')) {
                        var otherLinks = otherNextElem.getElementsByTagName('a');
                        // Find the first link with an href attribute
                        for (var k = 0; k < otherLinks.length; k++) {
                            var otherHref = otherLinks[k].getAttribute('href');
                            if (otherHref) {
                                if (otherHref === mainHref) {
                                    otherRefs.push(name);
                                }
                                break;
                            }
                        }
                    }
                }
            }
        } catch (err) {
        }
        return otherRefs;
    }

    // Initialize the candidates in the current document
    // (only register listener for element of class 'covlnk'
    // with a supported href)
    function register () {
        try {
            var lnks = document.getElementsByClassName('covlnk');
            if (lnks) {
                for (var i = 0; i < lnks.length; i++) {
                    var lnk = lnks[i];
                    var ref = getCandidateRef(lnk.getAttribute('href'));
                    if (ref) {
                        addListener(lnk, 'mouseover', openTooltip);

                        // For sanitizer reports, find other coverage elements on the same line
                        var otherRefs;
                        if (isSanitizerReport()) {
                            otherRefs = findOtherCoverageRefs(ref);
                            if (otherRefs && otherRefs.length > 0) {
                                href2Span[ref] = otherRefs;
                            }
                        } else {
                            // Rely on otherRefs for non-sanitizer reports
                            otherRefs = lnk.getAttribute('otherRefs');
                            if (otherRefs) {
                                var refs = otherRefs.split(',');
                                href2Span[ref] = refs;
                            }
                        }
                    }
                }
            }
            fixAbsolutePath();
        } catch (err) {
        }
    }

    // Close/delete the current opened tooltip
    function closeTooltip (event) {
        // Close the tooltip if opened
        var sElem = href2Span.current;
        if (sElem && sElem[1]) {
            // Close the tooltip
            sElem[1].removeChild(sElem[0]);
            href2Span.current = undefined;
        }
    }

    // Helper for positioning the tooltip
    function getCoords (originalElement) {
        var left = 0;
        var top = 0;
        var width = 0;
        var height = 0;

        var coords = [];

        var offsetParent = null;
        var element = null;

        if (originalElement == null) {
            return null;
        }

        offsetParent = originalElement.offsetParent;
        element = originalElement;

        if (originalElement.offsetWidth) {
            width = originalElement.offsetWidth;
        }

        if (originalElement.offsetHeight) {
            height = originalElement.offsetHeight;
        }

        while (element.parentNode != null) {
            element = element.parentNode;

            if (element.offsetParent != null) {
                // Handle scrolling
                if (element.scrollLeft && (element.scrollLeft > 0)) {
                    left -= element.scrollLeft;
                }

                if (element.scrollTop && (element.scrollTop > 0)) {
                    top -= element.scrollTop;
                }
            }

            if (element === offsetParent) {
                left += originalElement.offsetLeft;
                if (element.clientLeft && (element.nodeName !== 'TABLE')) {
                    left += element.clientLeft;
                }

                top += originalElement.offsetTop;
                if (element.clientTop && (element.nodeName !== 'TABLE')) {
                    top += element.clientTop;
                }

                originalElement = element;
                offsetParent = originalElement.offsetParent;

                if (originalElement.offsetParent == null) {
                    if (originalElement.offsetLeft) {
                        left += originalElement.offsetLeft;
                    }

                    if (originalElement.offsetTop) {
                        top += originalElement.offsetTop;
                    }
                }
            }
        }

        coords.left = left;
        coords.top = top;
        coords.width = width;
        coords.height = height;

        return (coords);
    }

    // Get the node's details corresponding to the given ref
    function getNodeDetails (ref) {
        var obj;
        var objs = document.getElementsByName('tt_' + ref);
        if (objs) {
            obj = objs[0];
            var parent = obj.parentNode;
            if (parent && (parent.nodeName.toUpperCase() === 'DIV') && (parent.getAttribute('name') === 'node_details')) {
                obj = obj.parentNode;
            }
        }
        return obj;
    }

    // Clone a DOM node and remove any inner href (but keep the links to the
    // run test information, justification and outcome filter)
    function cloneNodeForTooltip (aNode) {
        var newObj = aNode.cloneNode(true);
        var aList = newObj.getElementsByTagName('a');
        for (var i = 0; i < aList.length; i++) {
            var keepHref = false;
            var href = aList[i].getAttribute('href');
            if (typeof (href) === 'string') {
                if (href.startsWith('#testInfo_') ||
                    href.startsWith('#J') ||
                    href.startsWith('matlab:cvi.FilterExplorer')) {
                    keepHref = true;
                }
            }
            if (!keepHref) {
                aList[i].removeAttribute('href');
            }
        }
        return newObj;
    }

    // Helper for adding a new table's row in the tooltip
    function addTooltipRow (table, data) {
        var tr = document.createElement('tr');
        var td = document.createElement('td');

        table.appendChild(tr);
        tr.appendChild(td);
        td.appendChild(data);
    }

    // Create/show a tooltip
    function openTooltip (event) {
        try {
            // Early return if not a supported candidate
            var ref = getCandidateRef(event.target.getAttribute('href'));
            if (!ref) {
                return;
            }

            // Close the current tooltip
            var sElem = href2Span.current;
            if (sElem && sElem[1]) {
                sElem[1].removeChild(sElem[0]);
                href2Span.current = undefined;
            }

            // Create a new entry
            var obj = getNodeDetails(ref);
            if (obj) {
                var spanElem = document.createElement('span');
                spanElem.className = 'tooltip';
                var newObj = cloneNodeForTooltip(obj);

                var inputTopBarElem = document.createElement('input');
                inputTopBarElem.className = 'tooltipCloseButton';
                inputTopBarElem.type = 'button';
                inputTopBarElem.value = 'X';
                addListener(inputTopBarElem, 'click', closeTooltip);

                var spanTopBarElem = document.createElement('span');
                spanTopBarElem.appendChild(inputTopBarElem);
                spanElem.appendChild(spanTopBarElem);

                var otherRefs = href2Span[ref];
                var tableElem;
                if (otherRefs) {
                    for (var i = 0; i < otherRefs.length; i++) {
                        obj = getNodeDetails(otherRefs[i]);
                        if (obj) {
                            if (!tableElem) {
                                tableElem = document.createElement('table');
                                tableElem.setAttribute('class', 'tooltipManyRes');
                                addTooltipRow(tableElem, newObj);
                            }
                            var newOtherObj = cloneNodeForTooltip(obj);
                            addTooltipRow(tableElem, newOtherObj);
                        }
                    }
                }

                if (tableElem) {
                    spanElem.appendChild(tableElem);
                } else {
                    var spanContentElem = document.createElement('span');
                    spanContentElem.className = 'tooltipContent';
                    spanContentElem.appendChild(newObj);
                    spanElem.appendChild(spanContentElem);
                }

                var pos = getCoords(event.target.parentNode);
                spanElem.style.left = pos.left + 'px';
                spanElem.style.top = (pos.top + pos.height) + 'px';
                document.body.appendChild(spanElem);
                href2Span.current = [spanElem, document.body];
            }
        } catch (err) {
        }
    }

    function fixAbsolutePath () {
        try {
            var baseURI = document.baseURI;
            if (typeof (baseURI) !== 'string') {
                if (document.location) baseURI = document.location.href;
                if (typeof (baseURI) !== 'string') baseURI = window.location.href;
                if (typeof (baseURI) !== 'string') baseURI = document.URL.replace('\\', '/');
            }
            var path = baseURI.substring(0, baseURI.lastIndexOf('/'));
            var aList = document.getElementsByTagName('a');
            for (var i = 0; i < aList.length; i++) {
                var href = aList[i].href;
                if (href !== 'string' && href.search(/[.]html(#[A-Za-z]+[\w\-:.]*)*$/) !== -1) {
                    var hrefNotExpended = aList[i].getAttribute('href');
                    if (hrefNotExpended.search(/^#[A-Za-z]+[\w\-:.]*$/) === -1) {
                        var idx = href.lastIndexOf('/');
                        if (idx === -1) {
                            idx = href.lastIndexOf('\\');
                        }
                        if (idx !== -1) {
                            aList[i].setAttribute('href', path + href.substring(idx));
                        }
                    }
                }
            }
        } catch (err) {}
    }

    // Helper for registering a listener
    function addListener (obj, type, fn) {
        if (obj.addEventListener) {
            obj.addEventListener(type, fn, false);
        } else if (obj.attachEvent) {
            obj.attachEvent('on' + type, fn);
        }
    }

    // Register the listener
    addListener(window, 'load', register);
})();

// LocalWords:  covlnk mouseover tt cvi DOM
