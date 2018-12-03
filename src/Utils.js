import _ from 'lodash';

const getSpanMap = (textToHighlight, highlights) => {

    // ### Helper Functions

    // # Checks if item has an segment inside the scope
    const checkOverlap = (scope, item) => {
        for (let i = scope.startOffset; i <= scope.endOffset; i++) {
            if ( item.startOffset <= i && item.endOffset >= i) {
                return true;
            }
        }
        return false;
    }

    const checkOverlapMultiple = (arr, item) => {
        const overlappingHLs = [];

        for ( let i = item.startOffset; i <= item.endOffset; i++ ) {
            for ( let arrIndex = 0; arrIndex < arr.length; arrIndex++ ) {
                let arrItem = arr[arrIndex];
                if ( checkOverlap(arrItem, item) ) {
                    overlappingHLs.push(arrItem);
                }
            }
        }
        return overlappingHLs.length && true;
    }

    // # Generates an ID
    const generateID = hlObj => `${hlObj.priority}-${hlObj.color}-${hlObj.startOffset}-${hlObj.endOffset}`;

    // # Sort an Array by priority
    // highest to lowest
    const sortPriorityHL = arr => arr.sort((a, b) => b.priority - a.priority);
    // lowest to highest
    const sortPriorityLH = arr => arr.sort((a, b) => a.priority - b.priority);

    const sortOffsetLH = (groups) => {
        const sorted = [];

        for (let textI = 0; textI < textToHighlight.length; textI++) {
            for (let i = 0; i < groups.length; i++) {

                let highlightStart = groups[i][0].startOffset;
                if (highlightStart === textI) sorted.push(groups[i])
            }
        }

        return sorted;
    }

    // # Removes item from search pool and returns new, reduced object
    const removeFromPool = (pool, item) => {
        return pool.reduce((acc, cur) => {
            if (cur.id !== item.id) acc.push(cur);
            return acc;
        }, []);
    }

    // ### Main Functions

    // ### Group the highlights
    const groupHighlights = (highlights) => {
        const groups = [];

        // # If less then two highlight provided, return
        if (_.isUndefined(highlights) || _.isNull(highlights) || highlights.length === 0) {
            console.warn('no highlights provided');
            return;
        } else if (highlights.length === 1) {

            let span = makeSpanObj(null, highlights[0]);
            return [span];
        }

        // # Tag every highlight for easier data manipulation
        const highlightsMutated = _.forEach(_.clone(highlights), highlight => {
            let id = generateID(highlight);
            highlight.id = id;
        });

        // # Traverse & group
        const group = (pool) => {
            pool.forEach((highlight, i) => {
                let group = findOverlap(pool, highlight);
                sortPriorityLH(group);
                groups.push(group);
            });

            if (pool.length === 1) groups.push([pool[0]]); // TODO: quick-fix; single non-overlapping highlight gets ignored
        }
        group(highlightsMutated);

        // # sort the group in order of the text
        return sortOffsetLH(groups);
    }

    // # Check if current overlaps with any in the list
    const findOverlap = (pool, current) => {
        const group = []; // collection array
        const poolRef = pool; // reference to the object

        // Searching recursively from bottom (low priority) up
        const search = (pool, current) => {

            let reducedPool = removeFromPool(pool, current);

            for (let highlight of reducedPool) {
                // if (highlight === current) continue;

                // If the current highlight doesn't overlap the iterable highlight, go to next
                if (!checkOverlap(highlight, current)) continue;

                // Recursively search for overlaps in the reduce pool
                search(reducedPool, highlight);
            }

            // Add current to group
            group.push(current);

            // Remove current highlight from reference object
            poolRef.splice(poolRef.findIndex(h => h.id === current.id), 1);

        }
        search(pool, current);

        return group;
    }

    // ### Create Wrappers for highlights
    const createWrappers = (groups) => {
        const wrappers = groups.map(group => wrapperFactory(group));
        return wrappers;
    }

    // # Since some highlight overlap, we wrap the spans tp make it appear like the stretch behind the child
    // Note: to optimize this functionality, I would selectively wrap only the highlight that are overlapped
    const wrapperFactory = (group) => {
        const wrappers = [];

        // If a group consists of single highlight
        if (!Array.isArray(group)) {
            let wrapper = makeWrapperSpan(group, group.startOffset, group.endOffset);
            wrappers.push(wrapper);

        } else {
            // Starting with the highest highlight, find overlaps above
            const wrapHighlights = (pool, highlight) => {

                // find highlight above that overlap
                let overlaps = checkOverlapMultiple(pool, highlight);

                let wrapperStart = overlaps ? findFurthestStart(pool, highlight) : highlight.startOffset;
                let wrapperEnd = overlaps ? findFurthestEnd(pool, highlight) : highlight.endOffset;
                let wrapper = makeWrapperSpan(highlight, wrapperStart, wrapperEnd);
                wrappers.push(wrapper);

                let reducedPool = removeFromPool(pool, highlight);

                if (reducedPool.length) wrapHighlights(reducedPool, reducedPool[0]);

            }
            wrapHighlights(group, group[0]);

        }

        return wrappers;
    }

    const findFurthestStart = (pool, item) => {

        if (!item) return pool[0].startOffset;

        let iStart = item.startOffset;
        let iPriority = item.priority;

        for (let i = 0; i < pool.length; i++) {
            let hStart = pool[i].startOffset;
            let hPriority = pool[i].priority;
            if (hStart < iStart && hPriority > iPriority) iStart = hStart;
        }

        return iStart;
    }

    const findFurthestEnd = (pool, item) => {
        if (!item) return pool[0].endOffset;

        let iEnd = item.endOffset;
        let iPriority = item.priority;

        for (let i = 0; i < pool.length; i++) {
            let hEnd = pool[i].endOffset;
            let hPriority = pool[i].priority;
            if (hEnd > iEnd && hPriority > iPriority) iEnd = hEnd;
        }

        return iEnd;
    }

    const makeWrapperSpan = ( child, startOffset, endOffset ) => {
        const wrapper = {
            type: 'wrapper',
            id: child.id,
            startOffset,
            endOffset,
            priority: child.priority,
            color: child.color,
            highlights: { [child.id]: child.color }
        }
        return wrapper
    }

    const makeSpanObj = (i, defaultHL) => {
        const { color, priority } = defaultHL;
        let id = defaultHL.id ? defaultHL.id : generateID(defaultHL);

        // TODO: refactor a bit
        // null checks for the case where it's a group of a single highlight without and i is calling
        let start = !_.isNull(i) ? i : defaultHL.startOffset;
        let end = !_.isNull(i) ? i : defaultHL.endOffset;
        let string = !_.isNull(i) ? [textToHighlight[i]] : [textToHighlight.slice(start, end)];

        let stringStart = (!_.isNull(i) && defaultHL.startOffset) ? true : false;
        let stringEnd = (!_.isNull(i) && defaultHL.stringEnd) ? true : false;

        let span = {
            id,
            type: 'text',
            startOffset: start,
            endOffset: end,
            stringStart,
            stringEnd,
            string,
            color,
            priority,
        }

        return span;
    }

    const getHighlightsMap = (arr) => {
        const highlights = [];

        arr.forEach(highlight => {
            const id = generateID(highlight);
            highlights[id] = highlight.color;
        });

        return highlights;
    }

    // ###  Break up highlights into spans
    const makeSpans = (groups, wrappers) => {
        const spans = groups.map((group, i) => spanFactory(group, wrappers[i]));
        return spans;
    }

    const spanFactory = (group, wrapper) => {
        const spans = [];
        const range = wrapper[0];
        let factoryTracker = null;

        // If a group is a single highlight
        if (!Array.isArray(group)) {
            let span = makeSpanObj(null, group);
            span.highlights = {[span.id]: span.color}
            spans.push(span);
        } else {

            // Traverse the range of this group
            for (let i = range.startOffset; i <= range.endOffset; i++) {

                // check what highlights appear at this character index
                let inRange = group.filter(c => c.startOffset <= i && c.endOffset >= i);
                // 'inRangeIDs' is used as a unique identifier to compare at each itiration whether a new span is needed
                let inRangeIDs = inRange.reduce((acc, span) => {
                    acc.push(span.id);
                    return acc;
                }, []);

                // if it's the first letter or the 'inRangeIDs' variable has changed, create a new span
                if (factoryTracker === null || !_.isEqual(factoryTracker, inRangeIDs)) {

                    // check what the default styling for this span should be
                    let defaultHL = sortPriorityHL(inRange)[0];

                    // create the span object
                    let span = makeSpanObj(i, defaultHL);

                    // add highlights map
                    span.highlights = getHighlightsMap(inRange);

                    spans.push(span);

                } else {
                    let current = spans.length - 1;

                    spans[current].endOffset++;
                    spans[current].string.push(textToHighlight[i]);
                }

                factoryTracker = inRangeIDs;
            }
        }

        return spans;
    }

    const groups = groupHighlights(highlights);
    const wrappers = createWrappers(groups);
    const spans = makeSpans(groups, wrappers);

    return { groups, wrappers, spans };
}

export default getSpanMap;