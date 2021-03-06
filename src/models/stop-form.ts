import { NexTripDeparture } from './next-trip-departure';
import { RouteDir } from './route-dir';
import { MetroTransitAPI } from '../providers/metro-transit-api';
import { NotificationManager } from '../providers/notification-manager';
import { SingleNotification } from './notification-model';

/**
 * Describes a stop to be tracked, and preferences for tracking.
 */
export class StopForm {
    sNum : number // The stop number
    unTrackedRouteDirs : RouteDir[] // The list of route-directions to be tracked
    allRouteDirs : RouteDir[] // The list of route-directions serving this stop
    routeDirSchedules : Map<RouteDir, NexTripDeparture[]>
    notiSet : boolean // Whether notifications are enabled for this StopForm
    notiMinutes : number // Number of minutes ahead when the notification should fire
    updateTime : Date // Time of last update
    departures : NexTripDeparture[] // Array of filtered departures returned at last update
    nextNotiTime : Date // When the next notification should fire, based on last update
    nextNotiDep : NexTripDeparture // The departure for which the next notification should fire
    updateTimeString : string;
    name : string;

    constructor(sNum : number) {
        this.sNum = sNum;
        this.notiSet = false;
        this.unTrackedRouteDirs = [];
    }

    enableNoti(minutes : number) : void {
        this.notiSet = true;
        this.notiMinutes = minutes;
        this.updateNextNoti();
    }

    /**
     * Updates the list of departures for this stop.
     */
    update(metrotransitapi : MetroTransitAPI) : void {
        metrotransitapi.getDepartures(this.sNum).subscribe(
            values =>
            {
                this.allRouteDirs = [];
                this.routeDirSchedules = new Map<RouteDir, NexTripDeparture[]>();
                values.forEach(dep => {
                    dep.DepartureTime = metrotransitapi.parseJsonDate(dep.DepartureTime.toString());

                    var routeIndex = this.allRouteDirs.findIndex(function(element) {
                        return element.direction == dep.RouteDirection && element.route == dep.Route;
                    });

                    if(routeIndex == -1)
                    {
                        let rDir = new RouteDir(dep.Route, dep.RouteDirection);
                        this.allRouteDirs.push(rDir);
                        let tempScheduleArray = new Array<NexTripDeparture>();
                        tempScheduleArray.push(dep);
                        this.routeDirSchedules.set(rDir, tempScheduleArray);
                    }
                    else
                    {
                        let rDir = this.findRouteDir(dep.Route, dep.RouteDirection);
                        let tempScheduleArray = this.routeDirSchedules.get(rDir);
                        if(tempScheduleArray)
                            tempScheduleArray.push(dep);
                    }
                });
                this.allRouteDirs.sort(function(a, b){
                    if(a.toString() < b.toString()) { return -1; }
                    if(a.toString()  > b.toString()) { return 1; }
                    return 0;
                });
                this.departures = values;
                this.updateTime = new Date();
                this.updateTimeString = this.updateTime.toLocaleTimeString();

                this.updateNextNoti();
            },
            error =>
            {
                console.log(error);
            }
          );
    }

    isTrackedRouteDir(rDir : RouteDir) : boolean
    {
        let trackedDirs = this.getTrackedRouteDirs();
        for(let value of trackedDirs)
        {
            if(value.toString() == rDir.toString())
                return true;
        }
        return false;
    }

    getTrackedRouteDirs() : RouteDir[]
    {
        if(this.allRouteDirs == undefined)
            return [];
        let trackedRouteDirs = Object.assign([], this.allRouteDirs);
        for(let rDir of this.allRouteDirs)
        {
            this.unTrackedRouteDirs.forEach( (item, index) => {
                if(item.route == rDir.route && item.direction == rDir.direction) 
                {
                    let index = trackedRouteDirs.findIndex((value, index) => {
                        if(value.route == rDir.route && value.direction == rDir.direction)
                            return true;
                        else
                            return false;
                    });
                    if (index > -1) {
                        trackedRouteDirs.splice(index, 1);
                    }
                }
              });
        }
        return trackedRouteDirs;
    }

    updateNextNoti() : [Date, NexTripDeparture] {
        if(this.departures.length < 1)
            return;
            
        this.nextNotiDep = this.departures[0];
        this.nextNotiTime = new Date(this.nextNotiDep.DepartureTime.valueOf() - this.notiMinutes * 60000);

        /**
         * Updates the singleNotification firing time
         */
        let currentSingleNotifications : SingleNotification[] = NotificationManager.getSingleNotificationsForStop(this);
        for(let sNoti of currentSingleNotifications)
        {
            let newNotiData = this.getNextNotificationData(sNoti.minutesInterval);
            let content = `${newNotiData[3].route} ${newNotiData[3].direction} is departing in ${newNotiData[0]} minute(s)`;
            sNoti.content = content;
            sNoti.fireTime = newNotiData[1];
        }

        return [this.nextNotiTime, this.nextNotiDep];
    }

    getNextNotificationData(minutesInterval : number) : [Number, Date, NexTripDeparture, RouteDir] {
        var notificationTime, retDeparture, firingTime, routeDir;
        for(let dep of this.departures) {
            let rDir = new RouteDir(dep.Route, dep.RouteDirection);
            if(this.isTrackedRouteDir(rDir))
            {
                let minsUntilDep : number = Math.ceil((dep.DepartureTime.valueOf() - new Date().valueOf()) / 60000);
                if(minsUntilDep >= minutesInterval)
                {
                    routeDir = rDir;
                    notificationTime = minsUntilDep;
                    retDeparture = dep;
                    firingTime = new Date(dep.DepartureTime.valueOf() - minutesInterval * 60000);
                    break;
                }
            }
        }
        return [notificationTime, firingTime, retDeparture, routeDir];
    }

    findRouteDir(route : String, direction : String) : RouteDir
    {
        if(this.allRouteDirs) {
            let index = 0;
            for(let routeDir of this.allRouteDirs) {
                if(routeDir.route == route && routeDir.direction == direction) {
                    return routeDir;
                }
                index++;
            }
            return null;
        } else {
            return null;
        }
    }

    filterRouteDir(value: NexTripDeparture, index: number, array: NexTripDeparture[]) : boolean {
        if(this.allRouteDirs) {
            for(let routeDir of this.allRouteDirs) {
                if(routeDir.route == value.Route && routeDir.direction == value.RouteDirection) {
                    return true;
                }
            }
            return false;
        } else {
            return true;
        }
    }

    onClose()
    {
        NotificationManager.removeAllSingleNotificationForStop(this);
    }
}