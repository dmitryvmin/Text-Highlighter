import React, { Component } from 'react';
import logo from './logo.svg';
import './App.css';
import styled from 'styled-components';
import * as Color from 'color';
import getSpanMap from './Utils';
import _ from 'lodash';


// Move Utils functions to separate file
const checkOverlap = (scope, item) => {
    for (let i = scope.startOffset; i <= scope.endOffset; i++) {
        if ( item.startOffset <= i && item.endOffset >= i) {
            return true;
        }
    }
    return false;
}
const sortPriorityLH = arr => arr.sort((a, b) => a.priority - b.priority);

const getCurrentWrapper = (wrappers, root) => {
    if (wrappers && wrappers.length) {
        let current = wrappers.filter(wrapper => wrapper.id === root.id);
        return current;
    }
}

const getAllButCurrentW = (wrappers, root) => {

    if (!wrappers || (wrappers && !wrappers.length)) {
        return;
    }
    if (!root) {
        return null;
    }

    const rest = [];
    for (let i = 0; i < wrappers.length; i++) {
        if (wrappers[i].id !== root.id) {
            rest.push(wrappers[i]);
        }
    }
    return rest;
}

const getInnerWrapper = (wrappers, root) => {

    let nextInner = getAllButCurrentW(wrappers, root);
    if (!nextInner.length) {
        console.log('@@getInnerWrapper no more wrappers');
        return null;
    }
    // check that next inner wrapper fits - it's within the range of current & has higher priority
    // nextInner = wrappers.filter(wrapper => checkOverlap(wrappers, wrapper));
    // if (!nextInner.length) {
    //     console.log('@@getInnerWrapper next wrapper is outside the range');
    //     return null;
    // }
    nextInner = sortPriorityLH(nextInner);
    if (nextInner[0].priority < root.priority) {
        console.log('@@getInnerWrapper next wrapper has lower priority');
        return null;
    } else {
        return nextInner[0];
    }
}

const shouldPlaceWrapper = (wrappers, root, characterIndex) => {
    if (wrappers && !wrappers.length) {
        return false;
    }
   
    let inner = getInnerWrapper(wrappers, root);

    if (!inner) {
        return false;
    }
    if (inner.start === characterIndex) {
        return true;
    }
}

// Check whether on a span should be placed in this itiration of the Group Component
const shouldPlaceSpan = (wrappers, root, spans, i) => {
    const span = getSpanAtCurrent(spans, i);
                                               
    // wrappers.forEach(wrapper => {
    //     for (let i = wrapper.startOffset; i <= wrapper.endOffset; i++) {
    //         if ( characterIndex <= i && characterIndex >= i) {
                // if ( current.priority > wrapper.priority ) {
                //     console.log("span shouldn't be higher than it's wrapper");
                //     should = false;
                // }
    //         }
    //     }
    // });
    // let inner = getInnerWrapper(wrappers, root);
    // if (inner) {
    //     return false
    // }

    if (span) {
        return true
    }
}

const getSpanAtCurrent = (spans, i) => {
    if (!spans) {
        return null
    } else {
        let span = spans.length && _.find(spans, {startOffset: i});
        return span;
    }
}


class Span extends Component {
    constructor(props) {
        super(props);
    }
    render(){
        const { span, getColor, onMouseEnterHandler, onMouseLeaveHandler } = this.props;
        const style={ backgroundColor: getColor(span), transition: 'background-color 0.2s ease' };
        return(
            <span onMouseEnter={onMouseEnterHandler}
                  onMouseLeave={onMouseLeaveHandler}
                  id={span.id}
                  style={style}>
                {span.string.join('')}
            </span>
        )
    }
}


class Group extends Component {
    constructor(props) {
        super(props);
        this.state = {
            activeHL: null
        }
    }

    onMouseEnterHandler = event => {
        let target = event.target.id;
        this.setState({ activeHL: target });
    }

    onMouseLeaveHandler = event => {
        this.setState({ activeHL: null });
    }

    getColor = id => {
        let activeHL = this.state.activeHL
        if (activeHL) {
            if ( id.highlights && id.highlights[activeHL] ) {
                const color = Color(id.highlights[activeHL]);
                return color.darken(0.5).saturate(0.5).hex();
            } else {
                return 'transparent';
            }
        } else {
            return id.color;
        }
    }

    getBorderRadius = () => {


    }

    getContent = () => {
        const content = [];
        const { wrappers,
                root,
                spans,
                start,
                end,
                priority } = this.props;
        const { activeHL } = this.state;

        let skipTo = -1;

        for (let characterI = start; characterI <= end; characterI++) {

            if (skipTo <= characterI) {

                let placeWrapper = shouldPlaceWrapper(wrappers, root, characterI);

                if (placeWrapper) {
                    let inner = getInnerWrapper(wrappers, root);
                    let rest = getAllButCurrentW(wrappers, root);

                    content.push(
                        <Group key={`group-${inner.id}`}
                               start={characterI}
                               end={skipTo}
                               wrappers={rest}
                               spans={spans}
                               priority={inner.priority} />
                    )

                }

                let placeSpan = shouldPlaceSpan(wrappers, root, spans, characterI);
                if (placeSpan) {

                    let span = getSpanAtCurrent(spans, characterI);

                    skipTo = span.endOffset;
                    content.push(
                        <Span key={`span-${characterI}`}
                              span={span}
                              onMouseEnterHandler={this.onMouseEnterHandler}
                              onMouseLeaveHandler={this.onMouseLeaveHandler}
                              getColor={this.getColor}>
                            {span.string.join('')}
                        </Span>
                    )

                }

            }
        }

        return (content.length) ? content : null;

    }

    render() {
        const { root } = this.props;

        return (

                <span id={`wrapper-${root.id}`}
                      style={{ backgroundColor: this.getColor(root), transition: 'background-color 0.2s ease' }}>
                {this.getContent()}
                </span >

        )
    }
}




class App extends Component {
    state = {
        textToHighlight: promptString,
        highlights: promptHighlights,
    }

    getContent = () => {
        const { textToHighlight, highlights } = this.state;
        const spanMap = getSpanMap(textToHighlight, highlights);
        const print = [];
        let skipTo = -1;
        let mapCount = 0;

        console.log('@@', spanMap);

        for (let characterI = 0; characterI < textToHighlight.length; characterI++) {

            if (skipTo < characterI) {

                // Clean up
                let groupAtCurrentIndex = null;
                let currentMap = spanMap.wrappers[mapCount];
                if (currentMap && currentMap[0].startOffset === characterI) {
                    groupAtCurrentIndex = currentMap;
                    skipTo = currentMap[0].endOffset;
                }

                if (currentMap && currentMap[0].endOffset < characterI) groupAtCurrentIndex = null;

                if (groupAtCurrentIndex) {

                    // Fix up the single item vs multiple bug
                    const rootWrapper = spanMap.wrappers[mapCount][0];

                    print.push(
                        <Group key={`rootSpan-${characterI}`}
                               start={rootWrapper.startOffset}
                               end={rootWrapper.endOffset}
                               wrappers={currentMap}
                               root={rootWrapper}
                               spans={spanMap.spans[mapCount]}
                               priority={rootWrapper.priority} />
                        )
                    mapCount++;

                } else {
                    let character = promptString[characterI];
                    print.push(character);
                }
            }
        }

        return (print.length) ? print : null;

    }

  render() {

    const { textToHighlight,
            highlights } = this.state;

    return (
      <div className="App">
          <h1>{this.getContent()}</h1>
      </div>
    );
  }
}
export default App;

const promptString = 'Lorem ipsum dolor! Lorem ipsum dolor! Lorem ipsum dolor! Lorem ipsum dolor!';
const promptHighlights = [

    {
        startOffset: 0,
        endOffset: 6,
        color: '#f2cf8c',
        priority: 2
    },
    {
        startOffset: 3,
        endOffset: 15,
        color: '#e2b9fe',
        priority: 1
    },

    {
        startOffset: 10,
        endOffset: 20,
        color: 'yellow',
        priority: 3
    },

];
