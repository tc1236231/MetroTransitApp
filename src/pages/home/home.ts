import { Component } from '@angular/core';
import { NavController, NavParams, Events, AlertController } from 'ionic-angular';
import { NotificationPage } from '../notification/notification';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MetroTransitAPI } from '../../providers/metro-transit-api';
import { StopForm } from '../../models/stop-form';
import { Observable } from 'rxjs/Rx';
import { RouteDir } from '../../models/route-dir';
import { NotificationManager } from '../../providers/notification-manager';
import { FilterPage } from '../filter/filter';



@Component({
  selector: 'page-home',
  templateUrl: 'home.html'
})
export class HomePage {
  private stopQuery: FormGroup;
  private stops : StopForm[] = [];
  private subscriptionTimer; //temp to put it here for demo purpose
  private expandedRoutDirs : String[] = [];
  private bookMarkEventShouldFire : boolean = true;

  constructor(public navCtrl: NavController, private navParam: NavParams, private formBuilder: FormBuilder, private metrotransitapi : MetroTransitAPI, private events : Events, private alertCtrl: AlertController) {
    this.stopQuery = this.formBuilder.group({
      number: ['', Validators.required]
    });
  }

  presentHomeAlert1() {
    let alert = this.alertCtrl.create({
      title: 'Help',
      subTitle: 'Please enter in a stop number or use the map tab to search for a specific stop',
      buttons: ['OK']
    });
    alert.present();
  }

  presentHomeAlert2() {
    let alert = this.alertCtrl.create({
      title: 'Help',
      subTitle: 'This data automatically refreshes every 30 seconds. If you click on an individual route, the schedule for the route will display. To filter for specific routes, set a notification, or remove this stop, click on the icons',
      buttons: ['OK']
    });
    alert.present();
  }

  presentLoadingAlert()
  {
    let alert = this.alertCtrl.create({
      title: 'Wait!',
      subTitle: 'The information has not been fully loaded yet, please check your Internet access and try again later',
      buttons: ['OK']
    });
    alert.present();
  }

  refreshAllStops()
  {
    for(let stop of this.stops) {
      this.updateStop(stop);
    }
  }

  updateStop(stop : StopForm) {
    stop.update(this.metrotransitapi);
  }

  receiveStopNum() {
    let stopNumber = parseInt(this.stopQuery.get("number").value);
    this.stopQuery.reset();
    if(Number.isNaN(stopNumber))
    {
      this.presentHomeAlert1();
      return;
    }
    this.addStopCard(stopNumber);
  }

  addStopCard(stopNumber: number) //Creates the stop card for the entered stop
  {
    if(this.isStopDuplicate(stopNumber))
    {
      return;
    }
    let newStop : StopForm = new StopForm(stopNumber);
    newStop.update(this.metrotransitapi);
    let dataPromise = this.metrotransitapi.getStopDataByNum(stopNumber);
    newStop.name = "Loading...";
    dataPromise.then((res) => {
      newStop.name = res.stop_name;
    }).catch((err) => {
      newStop.name = 'Invalid Stop';
    });
    this.stops.push(newStop);
  }

  ionViewDidEnter() {
    this.events.subscribe('onStopSelectedFromMap', (prm) => {
      this.receiveStopFromMap(prm);
    });
  }
  //When the stop is entered from map, instead of search bar from main page
  receiveStopFromMap(param) {
    var stopNumber = param.stop_id;
    if (stopNumber !== undefined) {
      this.addStopCard(stopNumber);
    }
  }

  toggleExpandRouteInfo(event : Event, routeDir : RouteDir) : void
  {
    let index = this.expandedRoutDirs.indexOf(routeDir.toString());
    if(index != -1)
    {
      this.expandedRoutDirs.splice( index, 1 );
    }
    else
    {
      this.expandedRoutDirs.push(routeDir.toString());
    }
  }

  checkExpandStatus(routeDir : RouteDir) : boolean
  {
    return this.expandedRoutDirs.indexOf(routeDir.toString()) != -1;
  }

  getNotificationStatus(stop: StopForm) : boolean
  {
    return NotificationManager.getSingleNotificationStatusForStop(stop) != undefined;
  }

  //Adds this stop to the favorites pages, associated with the star icon
  bookmark(stop: StopForm) {
    if(!this.bookMarkEventShouldFire)
      return;
    
    this.navCtrl.parent.select(2);
    let prm = {stop_id: stop.sNum, stop_name: stop.name};
    this.events.publish("onStopSelectedForBookmark", prm);
    this.bookMarkEventShouldFire = false;
    setTimeout( () => {
      this.bookMarkEventShouldFire = true;
    }, 500);  
  }

  setFilter(stop: StopForm) {
    if(stop.updateTime == undefined)
    {
      this.presentLoadingAlert();
      return;
    }
    this.navCtrl.push(FilterPage, { stop: stop });
  }

  closeCard(stop : StopForm) {
    stop.onClose();
    this.stops.splice(this.stops.indexOf(stop),1);
  }

  presentCloseConfirm(stop : StopForm) {
    let alert = this.alertCtrl.create({
      title: 'Closing',
      message: 'You will NOT receive any notification for this bus stop. Are you sure?',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
          handler: () => {
          }
        },
        {
          text: 'Yes',
          handler: () => {
            this.closeCard(stop);
          }
        }
      ]
    });
    alert.present();
  }
  
//Makes sure only 1 card for each stop is shown
  isStopDuplicate(stopNumber: number) : boolean
  {
    for(let stop of this.stops)
    {
      if(stop.sNum == stopNumber)
        return true;
    }
    return false;
  }

  onClickSetNotification(event : Event, stop : StopForm) {
    event.stopPropagation();
    if(stop.updateTime == undefined)
    {
      this.presentLoadingAlert();
      return;
    }
    this.navCtrl.push(NotificationPage, {
      stop: stop
    });
  }

  ionViewDidLoad () {
    this.subscriptionTimer = Observable.interval(1000 * 30).subscribe(x => {
      this.refreshAllStops();
    });
  }
}
