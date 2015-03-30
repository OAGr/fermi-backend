'use strict';

var cytoscape_graph = {};
var cytoscape = require('cytoscape')
var _ = require('lodash');

var jsdom = require("jsdom");
var $ = require('jquery')(require("jsdom").jsdom().parentWindow);
var React = require('react');

var Cytoscape = React.createClass( {
  getDefaultProps:function(){
    return {
      config: {},
      nodes: {},
      edges: {},
      onDrag: function(){ return this },
      onTap: function(){ return this },
      onReady: function(){ return this },
      onChange: function(){ return this },
      ready: function(){}
    }
  },
  componentDidMount() {
    var cy = this.createCy()
    cytoscape_graph = cy
    this.setState({cy: cy})
  },
  componentDidUpdate(oldData) {
    newData = {elements:{nodes: this.props.nodes, edges: this.props.edges}}
    oldData = this.state.cy.json()

    getAllData = nodes => nodes.map(node => node.data)

    getTypeData = elementType => [oldData, newData].map( n => getAllData(n.elements[elementType] || []) )
    var [oldNodes, newNodes] = getTypeData('nodes')
    var [oldEdges, newEdges] = getTypeData('edges')

    nodeChanges = makeChanges(oldNodes, newNodes, 'nodeId')
    edgeChanges = makeChanges(oldEdges, newEdges, 'id')
  },
  prepareConfig(){
    that = this
    var defaults = {
      ready: function() {
        this.on('drag', function(e){
          that.props.onDrag(e)
        });
        this.on('tap', function(e){
          that.props.onTap(e)
        });
        this.on('pan', function(e){
          that.props.onPan(e)
        });
        that.props.onReady(this)
      }
    }
    return _.merge(defaults, this.props.config)
  },
  createCy(){
    tthis = this
    var config = this.prepareConfig()
    config.container = $('.cytoscape_graph')[0]
    var a = cytoscape(config)
    return a
  },
  render(){
    return (
      <div className="cytoscape_graph"></div>
    )
  }
})

var isArray = (typeof Array.isArray === 'function') ?
  // use native function
  Array.isArray :
  // use instanceof operator
  function(a) {
    return a instanceof Array;
  };

var trimUnderscore = function(str) {
  if (str.substr(0, 1) === '_') {
    return str.slice(1);
  }
  return str;
};

var isNode = data => (data.id.substr(0,1) === 'n')
var isEdge = data => (data.source !== undefined)

var getDeltaType = function(delta) {
  if (typeof delta === 'undefined') {
    return 'unchanged';
  }
  if (isArray(delta)) {
    if (delta.length === 1) {
      return 'added';
    }
    if (delta.length === 2) {
      return 'modified';
    }
    if (delta.length === 3 && delta[2] === 0) {
      return 'deleted';
    }
    if (delta.length === 3 && delta[2] === 2) {
      //text change
      return 'modified';
    }
  } else if (typeof delta === 'object') {
    // used to be 'node'
    return 'modified';
  }
  return 'unknown';
};

var formatDiff = function(diff) {
  if (typeof diff === "undefined") {
    return {changed: [], deleted: []}
  }
  else {
    Ids = _.select(Object.keys(diff), function(n){ return !isNaN(trimUnderscore(n))})
    withType = Ids.map( n => getDeltaType(diff[n]) )

    getAll = diffType => _.select(Ids, function(n){ return getDeltaType(diff[n]) == diffType })
    getAllFormatted = all => getAll(all).map(f => trimUnderscore(f))

    byType = {}
    _.map(["added", "modified", "deleted"], function(n){ byType[n] = getAllFormatted(n) })
    return byType
  }
}

var cytoChange = function(action, data) {
  cy = cytoscape_graph
  actions = {
    'modified': function(data) {
      element = cy.getElementById(data.id);
      element.removeData()
      element.data(data)
    },
    'deleted': function(data) {
      element = cy.getElementById(data.id);
      cy.remove(element)
    },
    'added': function(data) {
      if (isNode(data)) {
        cy.add({group:"nodes", data: data, position: {x:1000, y:500}})
      }
      else if (isEdge(data)) {
        cy.add({group:"edges", data: data})
      }
    }
  }
  actions[action](data)
}

var makeChanges = function(older, newer, diffKey) {
  differ = jsondiffpatch.create({objectHash(obj){return obj[diffKey]}})
  diff = differ.diff(older, newer)
  if (diff) {
    formatted = formatDiff(diff)
    formatted.modified.map( n => cytoChange('modified', newer[n]) )
    formatted.added.map( n => cytoChange('added', newer[n]) )
    formatted.deleted.map( n => cytoChange('deleted', older[n]) )
  }
}

module.exports = Cytoscape