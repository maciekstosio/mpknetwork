const prepare = (lines) => {
    return Object.keys(lines).reduce((acc, curr) => {
        return {
            ...acc,
            [curr]: lines[curr].reduce((acc, curr) => {
                return {
                    ...acc,
                    [curr[0]]: parseFloat(curr[1]),
                }
            }, {})
        }
    }, {})
}

const colorForTime = (time) => {
    if (time <=5) return "#0aa11e"
    if (time <=10) return "#1ee839"
    if (time <=15) return "#91ff00"
    if (time <=20) return "#d9ff00"
    if (time <=25) return "#fff700"
    if (time <=30) return "#ffd500"
    if (time <=35) return "#ffa200"
    if (time <=40) return "#ff7b00"
    if (time <=45) return "#ff4d00"
    if (time <=55) return "#c20000"
    if (time <=50) return "#ff1900"
    return "#8f0000"
} 

const colorForLayers = (time) => {
    switch(time) {
        case 0: return "#34c9eb"
        case 1: return "#fcfc0f"
        case 2: return "#00ff08"
        case 3: return "#ff1900"
        default: return "#f0f"
    }
} 

const main = async () => {
    try {
        const coords = await d3.csv("data/coords.csv")

        const coords_map = coords.reduce((acc, curr) => ({
            ...acc,
            [curr.stop]: curr
        }), {})

        const lines = {
            night: prepare(lines_night),
            day: prepare(lines_day),
        }

        const app = new Vue({
            el: '#app',
            data: {
                distanceScale: 0,
                time: "day",
                max_time: 100,
                walk_distance: 100,
                map: null,
                baseLayer: null,
                stops: [],
                layers: []
            },
            methods: {
                updateZoom: function() {
                    const centerLatLng = this.map.getCenter() // get map center
                    const pointC = this.map.latLngToContainerPoint(centerLatLng) // convert to containerpoint (pixels)
                    const pointX = [pointC.x + 1, pointC.y] // add one pixel to x
                    const pointY = [pointC.x, pointC.y + 1] // add one pixel to y

                    // convert containerpoints to latlng's
                    const latLngC = this.map.containerPointToLatLng(pointC)
                    const latLngX = this.map.containerPointToLatLng(pointX)
                    const latLngY = this.map.containerPointToLatLng(pointY)

                    const distanceX = latLngC.distanceTo(latLngX) // calculate distance between c and x (latitude)
                    const distanceY = latLngC.distanceTo(latLngY) // calculate distance between c and y (longitude)
                    //1px ~ distanceX, px * distanceX = distance_for_pixels
                    this.distanceScale = 1/distanceX
                    this.layers.forEach((_, index) => this.refreashLayer(index))
                },
                setDay: function() {
                    if (this.time !== "day") {
                        this.time = "day"
                        this.setTheme(true)
                        this.layers.forEach((_, index) => this.hideLayer(index))
                        this.layers = []
                    }
                },
                setNight: function() {
                    if (this.time !== "night") {
                        this.time = "night"
                        this.setTheme(false)
                        this.layers.forEach((_, index) => this.hideLayer(index))
                        this.layers = []
                    }
                },
                hideLayer: function(layerIndex) {
                    this.layers[layerIndex].markers.forEach(stop => stop.remove())
                },
                refreashLayer: function(layerIndex) {
                    this.layers[layerIndex].markers.forEach(stop => stop.remove())
                    this.showLayer(layerIndex)
                },
                removeLayer: function(layerIndex) {
                    this.hideLayer(layerIndex)
                    this.layers.splice(layerIndex, 1)
                    this.fixFirstLayer()
                },
                fixFirstLayer: function() {
                    if (this.layers.length > 0) {
                        this.hideLayer(0)
                        this.showLayer(0)
                    }
                },
                onClick: function (stop) {
                    const possible_lines = lines[this.time]
                    const lines_containing_selected_stop = Object.keys(possible_lines).filter(line => possible_lines[line][stop] !== undefined)

                    const normLine = (curr) => {
                        const stops = possible_lines[curr] 
                        const selected_stop_time = stops[stop]
                        
                        return Object.keys(stops).reduce((acc, curr) => ({
                            ...acc,
                            [curr]: Math.abs(stops[curr] - selected_stop_time)
                        }), {})
                    }

                    if(lines_containing_selected_stop.length > 0) {
                        this.layers.push({
                            name: stop,
                            selected_lines: lines_containing_selected_stop,
                            stops: lines_containing_selected_stop.reduce((acc, curr) => ({
                                ...acc,
                                ...normLine(curr),
                            }), {}),
                            markers: [],
                        })

                        this.showLayer(this.layers.length - 1)
                        this.fixFirstLayer()
                    } else {
                        alert("Brak lini")
                    }
                },
                showLayer: function(layerIndex) {
                    const hasMoreLayers = this.layers.length > 1
                    const layer = this.layers[layerIndex]
                    const base_time = layer.stops[layer.name]
                    this.layers[layerIndex].markers = Object.keys(layer.stops).map(stop => {
                        const stop_time = layer.stops[stop]
                        const { lattitude, longitude } = coords_map[stop]

                        if (Math.abs(base_time - stop_time) < this.computed_max_time) {
                            return L.circleMarker([lattitude, longitude], {
                                radius: this.distanceScale * this.walk_distance,
                                stroke: false,
                                color: hasMoreLayers ? colorForLayers(layerIndex) : colorForTime(Math.abs(base_time - stop_time)),
                                fillOpacity: 100/this.walk_distance,
                            })
                            .on('click', () => this.onClick(stop))
                            .addTo(this.map)
                        }
                        
                        return null
                    }).filter(Boolean)
                },
                setTheme: function(isLight) {
                    const map_style = isLight ? 'mapbox/light-v9' : 'mapbox/dark-v9'
                    const marker_color = isLight ? '#222' : '#71c2f6'

                    this.stops.forEach(stop => stop.remove())

                    this.baseLayer = L.tileLayer('https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}', {
                        attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
                        maxZoom: 18,
                        id: map_style,
                        tileSize: 512,
                        zoomOffset: -1,
                        accessToken: 'sk.eyJ1IjoibWFjaWtlcmEiLCJhIjoiY2tibGdvaHVzMDBlcTMycDd1dTFhbHkzYyJ9.TsTlXgoGuUTqitJktEMaiQ'
                    })

                    this.baseLayer.addTo(this.map)

                    this.stops = coords.map(({ lattitude, longitude, stop }) => L.circleMarker([lattitude, longitude], {
                            radius: 2,
                            stroke: false,
                            fillOpacity: 1.0,
                            color: marker_color,
                        })
                        // .bindPopup(stop)
                        .addTo(this.map)
                        .on('click', () => this.onClick(stop))
                    )
                },
            },
            computed: {
                computed_max_time: function () {
                    return this.max_time >= 100 ? Infinity : this.max_time
                },
                computed_max_time_preview: function () {
                    return this.max_time >= 100 ? "∞" : this.max_time + " min"
                },
                computed_walk_distance: function() {
                    return Math.round(this.walk_distance/100)/10 + "km"
                }
            },
            watch: {
                computed_max_time: function(newTime) {
                    this.layers.forEach((_, index) => {
                        this.hideLayer(index)
                        this.showLayer(index)
                    })
                },
                walk_distance: function() {
                    this.layers.forEach((_, index) => this.refreashLayer(index))
                }
            },
            mounted() {
                this.map = L.map('map').setView([51.108004, 17.039528], 12)
                this.setTheme(true)
                this.updateZoom()
                this.map.on('zoomend', this.updateZoom)
            }
        })
    } catch (err) {
        console.log("Error", err)
    }
}

main()