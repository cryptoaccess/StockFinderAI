import React from 'react';
import { TouchableOpacity, Text, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import HomeScreen from './src/screens/HomeScreen';
import StockSearch from './src/screens/StockSearch';
import BlueChipDips from './src/screens/BlueChipDips';
import WatchList from './src/screens/WatchList';
import CongressTrades from './src/screens/CongressTrades';

const Stack = createStackNavigator();

const AppNavigator = () => (
  <NavigationContainer>
    <Stack.Navigator 
      initialRouteName="Home"
      screenOptions={{
        headerStyle: {
          backgroundColor: '#000000',
        },
        headerTintColor: '#ffffff',
        headerTitleStyle: {
          color: '#ffffff',
        },
        headerBackImage: () => null,
      }}
    >
      <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
      <Stack.Screen 
        name="StockSearch" 
        component={StockSearch} 
        options={({ navigation }) => ({
          headerLeft: () => (
            <TouchableOpacity 
              onPress={() => navigation.goBack()}
              style={{ marginLeft: 15, paddingVertical: 8, paddingHorizontal: 5 }}
            >
              <Text style={{ color: '#ffffff', fontSize: 17, fontWeight: '600' }}>Back</Text>
            </TouchableOpacity>
          ),
          title: '',
          headerRight: () => (
            <TouchableOpacity 
              onPress={() => navigation.navigate('Home')}
              style={{ marginRight: 15 }}
            >
              <Text style={{ color: '#ffffff', fontSize: 17, fontWeight: '600' }}>Home</Text>
            </TouchableOpacity>
          ),
        })}
      />
      <Stack.Screen 
        name="BlueChipDips" 
        component={BlueChipDips} 
        options={({ navigation }) => ({
          headerLeft: () => (
            <TouchableOpacity 
              onPress={() => navigation.goBack()}
              style={{ marginLeft: 15, paddingVertical: 8, paddingHorizontal: 5 }}
            >
              <Text style={{ color: '#ffffff', fontSize: 17, fontWeight: '600' }}>Back</Text>
            </TouchableOpacity>
          ),
          title: '',
          headerRight: () => (
            <TouchableOpacity 
              onPress={() => navigation.navigate('Home')}
              style={{ marginRight: 15 }}
            >
              <Text style={{ color: '#ffffff', fontSize: 17, fontWeight: '600' }}>Home</Text>
            </TouchableOpacity>
          ),
        })}
      />
      <Stack.Screen 
        name="WatchList" 
        component={WatchList} 
        options={({ navigation }) => ({
          headerLeft: () => (
            <TouchableOpacity 
              onPress={() => navigation.goBack()}
              style={{ marginLeft: 15, paddingVertical: 8, paddingHorizontal: 5 }}
            >
              <Text style={{ color: '#ffffff', fontSize: 17, fontWeight: '600' }}>Back</Text>
            </TouchableOpacity>
          ),
          title: '',
          headerRight: () => (
            <TouchableOpacity 
              onPress={() => navigation.navigate('Home')}
              style={{ marginRight: 15 }}
            >
              <Text style={{ color: '#ffffff', fontSize: 17, fontWeight: '600' }}>Home</Text>
            </TouchableOpacity>
          ),
        })}
      />
      <Stack.Screen 
        name="CongressTrades" 
        component={CongressTrades} 
        options={({ navigation }) => ({
          headerLeft: () => (
            <TouchableOpacity 
              onPress={() => navigation.goBack()}
              style={{ marginLeft: 15, paddingVertical: 8, paddingHorizontal: 5 }}
            >
              <Text style={{ color: '#ffffff', fontSize: 17, fontWeight: '600' }}>Back</Text>
            </TouchableOpacity>
          ),
          title: '',
          headerRight: () => (
            <TouchableOpacity 
              onPress={() => navigation.navigate('Home')}
              style={{ marginRight: 15 }}
            >
              <Text style={{ color: '#ffffff', fontSize: 17, fontWeight: '600' }}>Home</Text>
            </TouchableOpacity>
          ),
        })}
      />
    </Stack.Navigator>
  </NavigationContainer>
);

export default AppNavigator;
