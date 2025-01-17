import React from 'react';
import PropTypes from 'prop-types';
import _ from 'lodash';
import styled from 'styled-components';
import { graphql } from 'react-apollo';
import { compose, getContext, withHandlers, withPropsOnChange, lifecycle } from 'recompose';
import { CALL_STATUS_IDLE } from 'react-sip';
import { connect } from 'react-redux';
import { List, ListItem, ListItemText, ListSubheader } from '@material-ui/core';
import { UpdateDialer } from '../graphql/mutations';

const timeago = require('timeago.js');

const timeagoDictionary = (number, index) => {
  return [
    ['just now', 'a while'],
    ['less than a minute ago', 'in less than a minute'],
    ['1 minute ago', 'in 1 minute'],
    ['%s minutes ago', 'in %s minutes'],
    ['1 hour ago', 'in 1 hour'],
    ['%s hours ago', 'in %s hours'],
    ['1 day ago', 'in 1 day'],
    ['%s days ago', 'in %s days'],
    ['1 week ago', 'in 1 week'],
    ['%s weeks ago', 'in %s weeks'],
    ['1 month ago', 'in 1 month'],
    ['%s months ago', 'in %s months'],
    ['1 year ago', 'in 1 year'],
    ['%s years ago', 'in %s years'],
  ][index];
};
timeago.register('custom', timeagoDictionary);

const timeagoInstance = timeago();

const Wrapper = styled.div`
  flex-grow: 1;
  display: flex;
`;

const DialLog = ({ entries, onListItemClick, allowListItemClicks }) => (
  <Wrapper>
    <List subheader={<ListSubheader>Your Call Log</ListSubheader>}>
      {_.map(entries, (entry, i) => (
        <ListItem
          button={allowListItemClicks}
          key={i}
          data-phonenumber={entry.phoneNumber}
          onClick={onListItemClick}
        >
          <ListItemText
            primary={entry.phoneNumber}
            secondary={timeagoInstance.format(entry.startTimestamp, 'custom')}
          />
        </ListItem>
      ))}
    </List>
  </Wrapper>
);

export default compose(
  graphql(UpdateDialer, { name: 'updateDialer' }),
  getContext({
    call: PropTypes.object,
  }),
  connect((state) => state.callLog),
  withPropsOnChange(['call'], ({ call }) => ({
    allowListItemClicks: call.status === CALL_STATUS_IDLE,
  })),
  lifecycle({
    state: {
      ticksElapsed: 0,
    },
    componentDidMount() {
      this.ticker = setInterval(
        () =>
          this.setState((state) => ({
            ticksElapsed: state.ticksElapsed + 1,
          })),
        5000,
      );
    },
    componentWillUnmount() {
      clearInterval(this.ticker);
    },
  }),
  withHandlers({
    onListItemClick: ({ updateDialer }) => (e) => {
      updateDialer({ variables: { phoneNumber: e.currentTarget.dataset['phonenumber'] } });
    },
  }),
)(DialLog);
